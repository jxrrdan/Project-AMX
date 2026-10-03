import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import axios from 'axios';

export interface CaptchaChallenge {
  driver: string;
  /** The token the client must return with its answer (local), or empty for widget drivers. */
  challengeId: string;
  /** Human-readable question to render (local driver); empty for widget-based drivers. */
  question: string;
  /** Widget site key for a hosted driver (e.g. Turnstile); empty for the local driver. */
  siteKey: string;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * CAPTCHA abstraction for public, unauthenticated forms (enquiry, service booking). Same pluggable
 * adapter shape as the SMS/email/DVLA services:
 *
 *  - CAPTCHA_DRIVER=local (default): a dependency-free, stateless arithmetic challenge. The server
 *    issues a signed token carrying the expected answer + expiry (HMAC over CAPTCHA_SECRET), so any
 *    instance can verify it without shared storage and without an external service — it works fully
 *    offline in this sandbox and is testable end to end.
 *  - CAPTCHA_DRIVER=turnstile: verifies a Cloudflare Turnstile widget token server-side against the
 *    siteverify API using TURNSTILE_SECRET. The production target; no bot heuristics of our own.
 *
 * The local driver is a deterrent for casual spam, not a defence against a determined attacker —
 * swap in Turnstile (or reCAPTCHA) for production by setting the driver and keys.
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly driver: string;
  private readonly secret: string;
  private readonly turnstileSecret: string;
  private readonly turnstileSiteKey: string;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('CAPTCHA_DRIVER', 'local');
    this.secret = this.config.get<string>('CAPTCHA_SECRET', 'dev-captcha-secret-change-me');
    this.turnstileSecret = this.config.get<string>('TURNSTILE_SECRET', '');
    this.turnstileSiteKey = this.config.get<string>('TURNSTILE_SITE_KEY', '');
  }

  /** Issue a fresh challenge for a public form to render. */
  issueChallenge(): CaptchaChallenge {
    if (this.driver === 'turnstile') {
      return { driver: 'turnstile', challengeId: '', question: '', siteKey: this.turnstileSiteKey };
    }
    const a = 1 + Math.floor(Math.random() * 9);
    const b = 1 + Math.floor(Math.random() * 9);
    const expiresAt = Date.now() + CHALLENGE_TTL_MS;
    const payload = `${a + b}.${expiresAt}`;
    const token = `${Buffer.from(payload).toString('base64url')}.${this.sign(payload)}`;
    return { driver: 'local', challengeId: token, question: `What is ${a} + ${b}?`, siteKey: '' };
  }

  /**
   * Verify a submitted CAPTCHA. Throws BadRequestException on any failure so a public handler can
   * simply `await captcha.verify(...)` before processing. `answer` is the typed number for the
   * local driver; for Turnstile the widget token is passed as `token` and `answer` is ignored.
   */
  async verify(token: string | undefined, answer: string | undefined): Promise<void> {
    if (this.driver === 'turnstile') {
      await this.verifyTurnstile(token);
      return;
    }
    this.verifyLocal(token, answer);
  }

  private verifyLocal(token: string | undefined, answer: string | undefined): void {
    if (!token || answer === undefined || answer === null || `${answer}`.trim() === '') {
      throw new BadRequestException('CAPTCHA answer is required');
    }
    const [encodedPayload, providedSig] = token.split('.');
    if (!encodedPayload || !providedSig) {
      throw new BadRequestException('Invalid CAPTCHA challenge');
    }
    let payload: string;
    try {
      payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    } catch {
      throw new BadRequestException('Invalid CAPTCHA challenge');
    }
    const expectedSig = this.sign(payload);
    if (!this.safeEqual(providedSig, expectedSig)) {
      throw new BadRequestException('Invalid CAPTCHA challenge');
    }
    const [expectedAnswer, expiresAtRaw] = payload.split('.');
    if (Date.now() > Number(expiresAtRaw)) {
      throw new BadRequestException('CAPTCHA expired — please try again');
    }
    if (Number(answer) !== Number(expectedAnswer)) {
      throw new BadRequestException('CAPTCHA answer was incorrect');
    }
  }

  private async verifyTurnstile(token: string | undefined): Promise<void> {
    if (!token) {
      throw new BadRequestException('CAPTCHA token is required');
    }
    if (!this.turnstileSecret) {
      this.logger.error('CAPTCHA_DRIVER=turnstile but TURNSTILE_SECRET is not set');
      throw new BadRequestException('CAPTCHA is misconfigured');
    }
    try {
      const params = new URLSearchParams({ secret: this.turnstileSecret, response: token });
      const { data } = await axios.post<{ success: boolean }>(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10_000 },
      );
      if (!data?.success) {
        throw new BadRequestException('CAPTCHA verification failed');
      }
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.logger.warn(`Turnstile verification error: ${err instanceof Error ? err.message : err}`);
      throw new BadRequestException('CAPTCHA verification failed');
    }
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }
}

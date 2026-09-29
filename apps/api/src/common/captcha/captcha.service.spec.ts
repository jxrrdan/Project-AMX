import { BadRequestException } from '@nestjs/common';
import { CaptchaService } from './captcha.service';

function makeConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = { CAPTCHA_DRIVER: 'local', CAPTCHA_SECRET: 'test-secret', ...overrides };
  return { get: (key: string, def?: string) => values[key] ?? def } as never;
}

/** Parse "What is a + b?" -> a + b, so we can answer the issued challenge. */
function solve(question: string): number {
  const [a, b] = question.match(/\d+/g)!.map(Number);
  return a + b;
}

describe('CaptchaService (local driver)', () => {
  it('accepts the correct answer to an issued challenge', async () => {
    const service = new CaptchaService(makeConfig());
    const challenge = service.issueChallenge();
    expect(challenge.driver).toBe('local');
    await expect(service.verify(challenge.challengeId, String(solve(challenge.question)))).resolves.toBeUndefined();
  });

  it('rejects an incorrect answer', async () => {
    const service = new CaptchaService(makeConfig());
    const challenge = service.issueChallenge();
    await expect(service.verify(challenge.challengeId, String(solve(challenge.question) + 1))).rejects.toThrow(BadRequestException);
  });

  it('rejects a missing answer', async () => {
    const service = new CaptchaService(makeConfig());
    const challenge = service.issueChallenge();
    await expect(service.verify(challenge.challengeId, '')).rejects.toThrow(BadRequestException);
    await expect(service.verify(challenge.challengeId, undefined)).rejects.toThrow(BadRequestException);
  });

  it('rejects a token signed with a different secret (tampering / forgery)', async () => {
    const attacker = new CaptchaService(makeConfig({ CAPTCHA_SECRET: 'attacker-secret' }));
    const forged = attacker.issueChallenge();
    const server = new CaptchaService(makeConfig({ CAPTCHA_SECRET: 'real-secret' }));
    await expect(server.verify(forged.challengeId, String(solve(forged.question)))).rejects.toThrow(BadRequestException);
  });

  it('rejects a structurally invalid token', async () => {
    const service = new CaptchaService(makeConfig());
    await expect(service.verify('not-a-real-token', '5')).rejects.toThrow(BadRequestException);
  });

  it('rejects an expired challenge', async () => {
    const service = new CaptchaService(makeConfig());
    const challenge = service.issueChallenge();
    const answer = String(solve(challenge.question));
    // Jump past the 5-minute TTL.
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000);
    try {
      await expect(service.verify(challenge.challengeId, answer)).rejects.toThrow(BadRequestException);
    } finally {
      (Date.now as jest.Mock).mockRestore();
    }
  });
});

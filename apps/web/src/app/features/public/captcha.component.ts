import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { environment } from '../../../environments/environment';

interface Challenge {
  driver: string;
  challengeId: string;
  question: string;
  siteKey: string;
}

interface TurnstileApi {
  render(host: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void }): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScript: Promise<void> | undefined;

/** Loads Cloudflare's Turnstile script once, on demand (only when the API reports the turnstile driver). */
function loadTurnstileScript(): Promise<void> {
  turnstileScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the verification widget'));
    document.head.appendChild(script);
  });
  return turnstileScript;
}

/**
 * Reusable CAPTCHA control for public forms. Fetches a challenge from the API's pluggable CAPTCHA
 * service and, for the local arithmetic driver, renders the question and an answer box. The parent
 * form reads `getResponse()` to include the token+answer in its submission and calls `reset()`
 * after an attempt. The Cloudflare Turnstile driver (production) renders Cloudflare's widget and
 * submits its token instead.
 */
@Component({
  selector: 'app-captcha',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    @if (challenge(); as c) {
      @if (c.driver === 'local') {
        <div class="captcha">
          <mat-form-field appearance="outline" class="answer">
            <mat-label>{{ c.question }}</mat-label>
            <input matInput type="number" inputmode="numeric" [(ngModel)]="answer" name="captchaAnswer" autocomplete="off" />
          </mat-form-field>
          <button mat-icon-button type="button" (click)="refresh()" title="New question" aria-label="New question">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      } @else {
        <div #widget class="widget"></div>
      }
    } @else {
      <p class="note">Loading verification…</p>
    }
  `,
  styles: [`
    .captcha { display: flex; align-items: center; gap: 8px; }
    .answer { width: 200px; }
    .note { color: var(--amx-text-secondary); font-size: 13px; }
  `],
})
export class CaptchaComponent implements OnInit, OnDestroy {
  readonly challenge = signal<Challenge | null>(null);
  answer = '';
  private widgetToken = '';
  private widgetId: string | undefined;
  private readonly widgetHost = viewChild<ElementRef<HTMLElement>>('widget');

  private readonly http = inject(HttpClient);

  ngOnInit(): void { this.refresh(); }

  refresh(): void {
    this.answer = '';
    this.widgetToken = '';
    this.http.get<Challenge>(`${environment.apiUrl}/public/captcha`).subscribe((c) => {
      this.challenge.set(c);
      if (c.driver === 'turnstile') {
        // Wait one tick so the @if has rendered the host element.
        setTimeout(() => void this.renderTurnstile(c.siteKey));
      }
    });
  }

  ngOnDestroy(): void {
    if (this.widgetId) {
      window.turnstile?.remove(this.widgetId);
    }
  }

  private async renderTurnstile(siteKey: string): Promise<void> {
    await loadTurnstileScript();
    const host = this.widgetHost()?.nativeElement;
    if (!host || !window.turnstile) return;
    if (this.widgetId) {
      window.turnstile.remove(this.widgetId);
    }
    this.widgetId = window.turnstile.render(host, {
      sitekey: siteKey,
      callback: (token: string) => (this.widgetToken = token),
      'expired-callback': () => (this.widgetToken = ''),
    });
  }

  /** Whether the control currently has something to submit (an answer, or a widget token). */
  valid(): boolean {
    const c = this.challenge();
    if (!c) return false;
    return c.driver === 'local' ? `${this.answer}`.trim() !== '' : this.widgetToken !== '';
  }

  /** Values the parent form includes in its POST body. */
  getResponse(): { captchaToken: string; captchaAnswer: string } {
    if (this.challenge()?.driver === 'turnstile') {
      return { captchaToken: this.widgetToken, captchaAnswer: '' };
    }
    return { captchaToken: this.challenge()?.challengeId ?? '', captchaAnswer: `${this.answer}`.trim() };
  }

  /** Fetch a fresh challenge (call after a submit attempt — a solved/failed one shouldn't be reused). */
  reset(): void { this.refresh(); }
}

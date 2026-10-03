import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
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

/**
 * Reusable CAPTCHA control for public forms. Fetches a challenge from the API's pluggable CAPTCHA
 * service and, for the local arithmetic driver, renders the question and an answer box. The parent
 * form reads `getResponse()` to include the token+answer in its submission and calls `reset()`
 * after an attempt. A Turnstile/reCAPTCHA driver would render its widget instead (production).
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
        <p class="note">Verification widget ({{ c.driver }}) loads here.</p>
      }
    } @else {
      <p class="note">Loading verification…</p>
    }
  `,
  styles: [`
    .captcha { display: flex; align-items: center; gap: 8px; }
    .answer { width: 200px; }
    .note { color: rgba(0,0,0,0.6); font-size: 13px; }
  `],
})
export class CaptchaComponent implements OnInit {
  readonly challenge = signal<Challenge | null>(null);
  answer = '';

  private readonly http = inject(HttpClient);

  ngOnInit(): void { this.refresh(); }

  refresh(): void {
    this.answer = '';
    this.http.get<Challenge>(`${environment.apiUrl}/public/captcha`).subscribe((c) => this.challenge.set(c));
  }

  /** Whether the control currently has something to submit (an answer, or a widget token). */
  valid(): boolean {
    const c = this.challenge();
    if (!c) return false;
    return c.driver === 'local' ? `${this.answer}`.trim() !== '' : true;
  }

  /** Values the parent form includes in its POST body. */
  getResponse(): { captchaToken: string; captchaAnswer: string } {
    return { captchaToken: this.challenge()?.challengeId ?? '', captchaAnswer: `${this.answer}`.trim() };
  }

  /** Fetch a fresh challenge (call after a submit attempt — a solved/failed one shouldn't be reused). */
  reset(): void { this.refresh(); }
}

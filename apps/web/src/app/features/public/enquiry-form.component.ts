import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { environment } from '../../../environments/environment';

/**
 * The public, embeddable enquiry form (Feature Spec §8.1) — no login, dealer-scoped by the
 * `:dealerId` in the URL, posting to the same unauthenticated endpoint a dealer's own website
 * would embed this against. Try it at /enquiry/<dealerId> without logging in.
 */
@Component({
  selector: 'app-enquiry-form',
  imports: [FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatCheckboxModule],
  template: `
    <div class="page">
      <mat-card class="card">
        @if (submitted()) {
          <h1>Thank you!</h1>
          <p>A member of the sales team will be in touch shortly.</p>
        } @else {
          <h1>Get in touch</h1>
          <p class="subtitle">Interested in a vehicle? Send us your details and we'll call you back.</p>

          <div class="row">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>First name</mat-label>
              <input matInput [(ngModel)]="firstName" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Last name</mat-label>
              <input matInput [(ngModel)]="lastName" />
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Email</mat-label>
            <input matInput type="email" [(ngModel)]="email" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Phone</mat-label>
            <input matInput [(ngModel)]="phone" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Message</mat-label>
            <textarea matInput rows="3" [(ngModel)]="message" placeholder="e.g. Is the 320d still available?"></textarea>
          </mat-form-field>

          <mat-checkbox [(ngModel)]="gdprConsent">I agree to be contacted about this enquiry (GDPR consent)</mat-checkbox>

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }

          <button mat-flat-button color="primary" class="full-width submit" [disabled]="!canSubmit() || submitting()" (click)="submit()">
            Send enquiry
          </button>
        }
      </mat-card>
    </div>
  `,
  styles: [
    `
      .page {
        display: flex;
        justify-content: center;
        padding: 48px 16px;
        min-height: 100vh;
        background: #f5f6f8;
      }
      .card {
        width: 100%;
        max-width: 480px;
        padding: 32px;
      }
      .subtitle {
        color: rgba(0, 0, 0, 0.6);
        margin-top: -8px;
      }
      .row {
        display: flex;
        gap: 12px;
      }
      .full-width {
        width: 100%;
      }
      .submit {
        margin-top: 8px;
      }
      .error {
        color: #c62828;
        font-size: 13px;
      }
    `,
  ],
})
export class EnquiryFormComponent {
  firstName = '';
  lastName = '';
  email = '';
  phone = '';
  message = '';
  gdprConsent = false;

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly error = signal<string | null>(null);

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  canSubmit(): boolean {
    return !!(this.firstName && this.lastName && (this.email || this.phone) && this.gdprConsent);
  }

  submit(): void {
    const dealerId = this.route.snapshot.paramMap.get('dealerId');
    this.error.set(null);
    this.submitting.set(true);

    this.http
      .post(`${environment.apiUrl}/dealers/${dealerId}/enquiries`, {
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email || undefined,
        phone: this.phone || undefined,
        message: this.message || undefined,
        gdprConsent: this.gdprConsent,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.submitted.set(true);
        },
        error: () => {
          this.submitting.set(false);
          this.error.set('Something went wrong sending your enquiry — please try again.');
        },
      });
  }
}

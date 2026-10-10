import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { environment } from '../../../environments/environment';
import { CaptchaComponent } from './captcha.component';

/**
 * Public customer portal page (#4) — an agent's own website or a QR code links here so a customer
 * can request a service booking with no login. Mirrors the public enquiry-form (§8.1) pattern.
 */
@Component({
  selector: 'app-book-service',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, CaptchaComponent],
  template: `
    <div class="wrap">
      <mat-card class="card">
        @if (done()) {
          <h2>Thank you</h2>
          <p>Your service booking request has been received@if (dealerName()) { by {{ dealerName() }} }. We'll be in touch shortly to confirm.</p>
          <button mat-stroked-button (click)="reset()">Submit another</button>
        } @else {
          <h2>Book a service</h2>
          <mat-form-field appearance="outline" class="full"><mat-label>Your name</mat-label><input matInput [(ngModel)]="form.customerName" /></mat-form-field>
          <mat-form-field appearance="outline" class="full"><mat-label>Email</mat-label><input matInput [(ngModel)]="form.contactEmail" /></mat-form-field>
          <mat-form-field appearance="outline" class="full"><mat-label>Phone</mat-label><input matInput [(ngModel)]="form.contactPhone" /></mat-form-field>
          <mat-form-field appearance="outline" class="full"><mat-label>Vehicle registration</mat-label><input matInput [(ngModel)]="form.vehicleReg" /></mat-form-field>
          <mat-form-field appearance="outline" class="full"><mat-label>Service required</mat-label><input matInput [(ngModel)]="form.serviceType" placeholder="e.g. Annual service, MOT" /></mat-form-field>
          <mat-form-field appearance="outline" class="full"><mat-label>Preferred date</mat-label><input matInput type="date" [(ngModel)]="form.preferredDate" /></mat-form-field>
          <mat-form-field appearance="outline" class="full"><mat-label>Notes (optional)</mat-label><textarea matInput rows="2" [(ngModel)]="form.notes"></textarea></mat-form-field>
          <app-captcha #captcha />
          @if (error()) { <p class="error">{{ error() }}</p> }
          <button mat-flat-button color="primary" [disabled]="!valid() || submitting()" (click)="submit()">Request booking</button>
        }
      </mat-card>
    </div>
  `,
  styles: [`
    .wrap { display: flex; justify-content: center; padding: 32px 16px; }
    .card { width: 100%; max-width: 480px; padding: 24px; display: flex; flex-direction: column; gap: 8px; }
    .full { width: 100%; }
    .error { color: var(--amx-danger-fg); }
  `],
})
export class BookServiceComponent implements OnInit {
  @ViewChild('captcha') captcha!: CaptchaComponent;
  readonly done = signal(false);
  readonly dealerName = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);
  form = { customerName: '', contactEmail: '', contactPhone: '', vehicleReg: '', serviceType: '', preferredDate: '', notes: '' };
  private dealerId = '';

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void { this.dealerId = this.route.snapshot.paramMap.get('dealerId') ?? ''; }

  valid(): boolean {
    return !!(this.form.customerName && this.form.vehicleReg && this.form.serviceType && this.captcha?.valid());
  }

  submit(): void {
    this.submitting.set(true);
    this.error.set(null);
    const captcha = this.captcha.getResponse();
    this.http.post<{ received: boolean; dealerName: string }>(`${environment.apiUrl}/public/booking/${this.dealerId}`, {
      customerName: this.form.customerName,
      contactEmail: this.form.contactEmail || undefined,
      contactPhone: this.form.contactPhone || undefined,
      vehicleReg: this.form.vehicleReg,
      serviceType: this.form.serviceType,
      preferredDate: this.form.preferredDate ? new Date(this.form.preferredDate).toISOString() : undefined,
      notes: this.form.notes || undefined,
      captchaToken: captcha.captchaToken,
      captchaAnswer: captcha.captchaAnswer,
    }).subscribe({
      next: (r) => { this.dealerName.set(r.dealerName); this.done.set(true); this.submitting.set(false); },
      error: (err) => { this.error.set(err?.error?.message ?? 'Could not submit request'); this.submitting.set(false); this.captcha.reset(); },
    });
  }

  reset(): void {
    this.form = { customerName: '', contactEmail: '', contactPhone: '', vehicleReg: '', serviceType: '', preferredDate: '', notes: '' };
    this.done.set(false);
  }
}

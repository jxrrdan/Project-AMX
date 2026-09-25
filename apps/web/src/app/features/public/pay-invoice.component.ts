import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { PAYMENT_METHOD_LABELS, PaymentMethod, PaymentSourceType } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface PayableInvoice {
  invoiceNumber: string;
  totalAmount: number;
  recipient: string;
  paidAt: string | null;
}

/**
 * Public "pay this invoice online" page — no login required, the invoice id itself (an
 * unguessable UUID) is the access control, the same convention as the VHC customer report page.
 * Closes the payments gap against Keyloop Payments / Pinewood's Bumper-integrated checkout.
 */
@Component({
  selector: 'app-pay-invoice',
  imports: [CurrencyPipe, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatSelectModule],
  template: `
    <div class="page">
      <mat-card class="content">
        @if (loading()) {
          <p>Loading invoice…</p>
        } @else if (notFound()) {
          <mat-icon class="icon">error_outline</mat-icon>
          <h1>Invoice not found</h1>
          <p>This payment link may have expired or been mistyped.</p>
        } @else if (invoice(); as inv) {
          @if (inv.paidAt || paid()) {
            <mat-icon class="icon success">check_circle</mat-icon>
            <h1>Payment received</h1>
            <p>{{ inv.invoiceNumber }} — {{ inv.totalAmount | currency: 'GBP' }} has been paid. Thank you.</p>
          } @else {
            <h1>Pay invoice {{ inv.invoiceNumber }}</h1>
            <p class="recipient">{{ inv.recipient }}</p>
            <p class="amount">{{ inv.totalAmount | currency: 'GBP' }}</p>
            <mat-form-field appearance="outline">
              <mat-label>Payment method</mat-label>
              <mat-select [(ngModel)]="method">
                @for (m of methods; track m) {
                  <mat-option [value]="m">{{ methodLabels[m] }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            @if (error()) {
              <p class="error">{{ error() }}</p>
            }
            <button mat-flat-button color="primary" [disabled]="paying()" (click)="pay()">
              {{ paying() ? 'Processing…' : 'Pay now' }}
            </button>
          }
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
        background: #f5f5f5;
      }
      .content {
        max-width: 420px;
        width: 100%;
        padding: 32px;
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: center;
      }
      .icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #999;
      }
      .icon.success {
        color: #2e7d32;
      }
      .recipient {
        color: #666;
      }
      .amount {
        font-size: 32px;
        font-weight: 600;
        margin: 8px 0;
      }
      .error {
        color: #c62828;
        font-size: 13px;
      }
      mat-form-field {
        width: 100%;
      }
    `,
  ],
})
export class PayInvoiceComponent implements OnInit {
  readonly invoice = signal<PayableInvoice | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly paying = signal(false);
  readonly paid = signal(false);
  readonly error = signal<string | null>(null);

  readonly methods = Object.values(PaymentMethod);
  readonly methodLabels = PAYMENT_METHOD_LABELS;
  method: PaymentMethod = PaymentMethod.CARD;

  private sourceType!: PaymentSourceType;
  private sourceId!: string;

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.sourceType = this.route.snapshot.paramMap.get('sourceType') as PaymentSourceType;
    this.sourceId = this.route.snapshot.paramMap.get('sourceId') as string;

    this.http.get<PayableInvoice>(`${environment.apiUrl}/payments/public/${this.sourceType}/${this.sourceId}`).subscribe({
      next: (data) => {
        this.invoice.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  pay(): void {
    this.paying.set(true);
    this.error.set(null);
    this.http.post(`${environment.apiUrl}/payments/public/${this.sourceType}/${this.sourceId}`, { sourceType: this.sourceType, method: this.method }).subscribe({
      next: () => {
        this.paying.set(false);
        this.paid.set(true);
      },
      error: (err) => {
        this.paying.set(false);
        this.error.set(err.error?.message ?? 'Payment failed — please try again.');
      },
    });
  }
}

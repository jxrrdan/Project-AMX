import { CurrencyPipe, DatePipe, KeyValuePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import {
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  PaymentKind,
  PaymentMethod,
} from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface Payment {
  id: string;
  kind: PaymentKind;
  method: PaymentMethod;
  amount: string;
  customerName: string;
  reference: string | null;
  receivedAt: string;
}

interface AccountOption {
  id: string;
  name: string;
}

interface Reconciliation {
  net: number;
  count: number;
  byMethod: Record<string, number>;
  byKind: Record<string, number>;
}

@Component({
  selector: 'app-cashiering',
  imports: [
    CurrencyPipe,
    DatePipe,
    KeyValuePipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
  ],
  template: `
    <div class="header">
      <h1>Cash Desk</h1>
      <button mat-flat-button color="primary" (click)="showForm.set(!showForm())">
        <mat-icon>point_of_sale</mat-icon> Take payment
      </button>
    </div>

    @if (recon(); as r) {
      <div class="tiles">
        <mat-card class="tile"><span class="num">{{ r.net | currency: 'GBP' }}</span><span>Net taken today</span></mat-card>
        <mat-card class="tile"><span class="num">{{ r.count }}</span><span>Transactions today</span></mat-card>
        @for (m of r.byMethod | keyvalue; track m.key) {
          <mat-card class="tile"><span class="num">{{ m.value | currency: 'GBP' }}</span><span>{{ methodLabelByKey(m.key) }}</span></mat-card>
        }
      </div>
    }

    @if (showForm()) {
      <mat-card class="form-card">
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Type</mat-label>
            <mat-select [(ngModel)]="form.kind">
              @for (k of kinds; track k) { <mat-option [value]="k">{{ kindLabels[k] }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Method</mat-label>
            <mat-select [(ngModel)]="form.method">
              @for (m of methods; track m) { <mat-option [value]="m">{{ methodLabels[m] }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Amount (£)</mat-label>
            <input matInput type="number" [(ngModel)]="form.amount" />
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Customer name</mat-label>
            <input matInput [(ngModel)]="form.customerName" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Reference (optional)</mat-label>
            <input matInput [(ngModel)]="form.reference" placeholder="e.g. INV-2026-00042" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Account customer (optional)</mat-label>
            <mat-select [(ngModel)]="form.accountCustomerId">
              <mat-option [value]="null">— None —</mat-option>
              @for (a of accounts(); track a.id) { <mat-option [value]="a.id">{{ a.name }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </div>
        <button mat-flat-button color="primary" [disabled]="!form.method || !form.amount || !form.customerName" (click)="take()">
          Record payment
        </button>
      </mat-card>
    }

    <table mat-table [dataSource]="payments()" class="mat-elevation-z1">
      <ng-container matColumnDef="receivedAt">
        <th mat-header-cell *matHeaderCellDef>When</th>
        <td mat-cell *matCellDef="let p">{{ p.receivedAt | date: 'short' }}</td>
      </ng-container>
      <ng-container matColumnDef="customer">
        <th mat-header-cell *matHeaderCellDef>Customer</th>
        <td mat-cell *matCellDef="let p">{{ p.customerName }}</td>
      </ng-container>
      <ng-container matColumnDef="kind">
        <th mat-header-cell *matHeaderCellDef>Type</th>
        <td mat-cell *matCellDef="let p"><mat-chip>{{ kindLabel(p.kind) }}</mat-chip></td>
      </ng-container>
      <ng-container matColumnDef="method">
        <th mat-header-cell *matHeaderCellDef>Method</th>
        <td mat-cell *matCellDef="let p">{{ methodLabel(p.method) }}</td>
      </ng-container>
      <ng-container matColumnDef="amount">
        <th mat-header-cell *matHeaderCellDef>Amount</th>
        <td mat-cell *matCellDef="let p">{{ +p.amount | currency: 'GBP' }}</td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
    @if (!payments().length) { <p class="empty">No payments recorded yet.</p> }
  `,
  styles: [
    `
      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .tiles { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
      .tile { flex: 1; min-width: 130px; padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; }
      .tile .num { font-size: 22px; font-weight: 600; }
      .form-card { padding: 16px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; max-width: 860px; }
      .row { display: flex; gap: 12px; }
      .row mat-form-field { flex: 1; }
      table { width: 100%; }
      .empty { color: rgba(0,0,0,0.5); margin-top: 16px; }
    `,
  ],
})
export class CashieringComponent implements OnInit {
  readonly payments = signal<Payment[]>([]);
  readonly accounts = signal<AccountOption[]>([]);
  readonly recon = signal<Reconciliation | null>(null);
  readonly showForm = signal(false);
  readonly columns = ['receivedAt', 'customer', 'kind', 'method', 'amount'];
  readonly kinds = Object.values(PaymentKind);
  readonly methods = Object.values(PaymentMethod);
  readonly kindLabels = PAYMENT_KIND_LABELS;
  readonly methodLabels = PAYMENT_METHOD_LABELS;

  form: { kind: PaymentKind; method: PaymentMethod | null; amount: number | null; customerName: string; reference: string; accountCustomerId: string | null } = {
    kind: PaymentKind.PAYMENT,
    method: PaymentMethod.CARD,
    amount: null,
    customerName: '',
    reference: '',
    accountCustomerId: null,
  };

  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  kindLabel(k: PaymentKind): string { return PAYMENT_KIND_LABELS[k]; }
  methodLabel(m: PaymentMethod): string { return PAYMENT_METHOD_LABELS[m]; }
  methodLabelByKey(key: string): string { return PAYMENT_METHOD_LABELS[key as PaymentMethod] ?? key; }

  ngOnInit(): void {
    this.load();
    this.http.get<AccountOption[]>(`${environment.apiUrl}/account-customers?active=true`).subscribe((d) => this.accounts.set(d));
  }

  load(): void {
    this.http.get<Payment[]>(`${environment.apiUrl}/payments`).subscribe((d) => this.payments.set(d));
    this.http.get<Reconciliation>(`${environment.apiUrl}/payments/reconciliation`).subscribe((d) => this.recon.set(d));
  }

  take(): void {
    const body = {
      kind: this.form.kind,
      method: this.form.method,
      amount: Number(this.form.amount),
      customerName: this.form.customerName,
      reference: this.form.reference || undefined,
      accountCustomerId: this.form.accountCustomerId || undefined,
    };
    this.http.post(`${environment.apiUrl}/payments`, body).subscribe({
      next: () => {
        this.snackBar.open('Payment recorded', 'Dismiss', { duration: 2500 });
        this.form.amount = null;
        this.form.customerName = '';
        this.form.reference = '';
        this.form.accountCustomerId = null;
        this.showForm.set(false);
        this.load();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not record payment', 'Dismiss', { duration: 4000 }),
    });
  }
}

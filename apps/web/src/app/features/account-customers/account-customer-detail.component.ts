import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { ACCOUNT_TRANSACTION_TYPE_LABELS, AccountTransactionType } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface Statement {
  customer: { id: string; name: string; creditLimit: number };
  openingBalance: number;
  closingBalance: number;
  lines: { id: string; type: AccountTransactionType; description: string; reference: string | null; occurredAt: string; signedAmount: number; runningBalance: number }[];
}

@Component({
  selector: 'app-account-customer-detail',
  imports: [CurrencyPipe, DatePipe, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatTableModule],
  template: `
    @if (statement(); as s) {
      <div class="header">
        <button mat-icon-button (click)="back()"><mat-icon>arrow_back</mat-icon></button>
        <span class="title">{{ s.customer.name }}</span>
        <span class="spacer"></span>
        <span class="balance" [class.owing]="s.closingBalance > 0">Balance: {{ s.closingBalance | currency: 'GBP' }}</span>
      </div>
      <p class="subtitle">Credit limit {{ s.customer.creditLimit | currency: 'GBP' }}</p>

      <mat-card class="form-card">
        <h3>Post transaction</h3>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Type</mat-label>
            <mat-select [(ngModel)]="form.type">
              @for (t of types; track t) { <mat-option [value]="t">{{ typeLabels[t] }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Amount (£)</mat-label><input matInput type="number" [(ngModel)]="form.amount" /></mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full"><mat-label>Description</mat-label><input matInput [(ngModel)]="form.description" /></mat-form-field>
        <mat-form-field appearance="outline" class="full"><mat-label>Reference (optional)</mat-label><input matInput [(ngModel)]="form.reference" /></mat-form-field>
        <button mat-flat-button color="primary" [disabled]="!form.amount || !form.description" (click)="post()">Post</button>
      </mat-card>

      <mat-card class="section">
        <h3>Statement</h3>
        <p class="opening">Opening balance: {{ s.openingBalance | currency: 'GBP' }}</p>
        <table mat-table [dataSource]="s.lines" class="mat-elevation-z1">
          <ng-container matColumnDef="occurredAt"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let l">{{ l.occurredAt | date: 'shortDate' }}</td></ng-container>
          <ng-container matColumnDef="description"><th mat-header-cell *matHeaderCellDef>Description</th><td mat-cell *matCellDef="let l">{{ l.description }}@if (l.reference) { <span class="muted"> · {{ l.reference }}</span> }</td></ng-container>
          <ng-container matColumnDef="type"><th mat-header-cell *matHeaderCellDef>Type</th><td mat-cell *matCellDef="let l">{{ typeLabel(l.type) }}</td></ng-container>
          <ng-container matColumnDef="amount"><th mat-header-cell *matHeaderCellDef>Amount</th><td mat-cell *matCellDef="let l" [class.credit]="l.signedAmount < 0">{{ l.signedAmount | currency: 'GBP' }}</td></ng-container>
          <ng-container matColumnDef="running"><th mat-header-cell *matHeaderCellDef>Balance</th><td mat-cell *matCellDef="let l">{{ l.runningBalance | currency: 'GBP' }}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
        @if (!s.lines.length) { <p class="empty">No transactions yet.</p> }
      </mat-card>
    }
  `,
  styles: [`
    .header { display: flex; align-items: center; gap: 8px; }
    .title { font-size: 18px; font-weight: 600; }
    .spacer { flex: 1 1 auto; }
    .balance.owing { color: var(--amx-danger-fg); font-weight: 600; }
    .subtitle { color: var(--amx-text-secondary); margin: 4px 0 16px 40px; }
    .form-card, .section { padding: 16px; margin-bottom: 16px; }
    .form-card { max-width: 520px; display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; gap: 12px; }
    .row mat-form-field { flex: 1; }
    .full { width: 100%; }
    table { width: 100%; }
    .muted { color: var(--amx-text-tertiary); }
    .credit { color: var(--amx-success-fg); }
    .opening { color: var(--amx-text-secondary); }
    .empty { color: var(--amx-text-tertiary); }
  `],
})
export class AccountCustomerDetailComponent implements OnInit {
  readonly statement = signal<Statement | null>(null);
  readonly columns = ['occurredAt', 'description', 'type', 'amount', 'running'];
  readonly types = Object.values(AccountTransactionType);
  readonly typeLabels = ACCOUNT_TRANSACTION_TYPE_LABELS;
  form = { type: AccountTransactionType.INVOICE, amount: null as number | null, description: '', reference: '' };
  private id = '';

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  typeLabel(t: AccountTransactionType): string { return ACCOUNT_TRANSACTION_TYPE_LABELS[t]; }

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.http.get<Statement>(`${environment.apiUrl}/account-customers/${this.id}/statement`).subscribe((d) => this.statement.set(d));
  }

  post(): void {
    this.http.post(`${environment.apiUrl}/account-customers/${this.id}/transactions`, {
      type: this.form.type,
      amount: Number(this.form.amount),
      description: this.form.description,
      reference: this.form.reference || undefined,
    }).subscribe({
      next: () => {
        this.snackBar.open('Transaction posted', 'Dismiss', { duration: 2500 });
        this.form = { type: AccountTransactionType.INVOICE, amount: null, description: '', reference: '' };
        this.load();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not post', 'Dismiss', { duration: 4000 }),
    });
  }

  back(): void { this.router.navigate(['/account-customers']); }
}

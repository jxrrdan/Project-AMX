import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AccountingProvider } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface Integration {
  id: string;
  provider: AccountingProvider;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  integration: { provider: string };
}

interface Reconciliation {
  amsTotal: number;
  syncedTotal: number;
  difference: number;
}

@Component({
  selector: 'app-accounting-list',
  imports: [
    CurrencyPipe,
    FormsModule,
    MatTableModule,
    MatChipsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h1>Accounting Integration</h1>

    <mat-card class="setup-card">
      <h3>Connected systems</h3>
      @for (i of integrations(); track i.id) {
        <mat-chip>{{ i.provider }}</mat-chip>
      }
      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>Connect a provider</mat-label>
          <mat-select [(ngModel)]="newProvider">
            <mat-option value="XERO">Xero</mat-option>
            <mat-option value="SAGE">Sage 50 / Sage 200</mat-option>
            <mat-option value="QUICKBOOKS">QuickBooks Online</mat-option>
            <mat-option value="CSV">Generic CSV export</mat-option>
          </mat-select>
        </mat-form-field>
        <button mat-flat-button color="primary" [disabled]="!newProvider" (click)="connectProvider()">Connect</button>
      </div>
    </mat-card>

    <mat-card class="reconciliation-card">
      <h3>Reconciliation report</h3>
      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>From</mat-label>
          <input matInput type="date" [(ngModel)]="reconFrom" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>To</mat-label>
          <input matInput type="date" [(ngModel)]="reconTo" />
        </mat-form-field>
        <button mat-stroked-button [disabled]="!reconFrom || !reconTo" (click)="runReconciliation()">Run</button>
      </div>
      @if (reconciliation(); as r) {
        <p>
          AMS total: {{ r.amsTotal | currency: 'GBP' }} · Synced total: {{ r.syncedTotal | currency: 'GBP' }} ·
          Difference: {{ r.difference | currency: 'GBP' }}
        </p>
      }
    </mat-card>

    <table mat-table [dataSource]="transactions()" class="mat-elevation-z1">
      <ng-container matColumnDef="provider">
        <th mat-header-cell *matHeaderCellDef>Provider</th>
        <td mat-cell *matCellDef="let t">{{ t.integration.provider }}</td>
      </ng-container>
      <ng-container matColumnDef="type">
        <th mat-header-cell *matHeaderCellDef>Type</th>
        <td mat-cell *matCellDef="let t">{{ t.type }}</td>
      </ng-container>
      <ng-container matColumnDef="amount">
        <th mat-header-cell *matHeaderCellDef>Amount</th>
        <td mat-cell *matCellDef="let t">{{ t.amount | currency: 'GBP' }}</td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Status</th>
        <td mat-cell *matCellDef="let t"><mat-chip>{{ t.status }}</mat-chip></td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let t">
          @if (t.status === 'PENDING') {
            <button mat-button (click)="sync(t.id)">Sync</button>
          }
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
  `,
  styles: [
    `
      mat-card {
        padding: 16px;
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      table {
        width: 100%;
      }
    `,
  ],
})
export class AccountingListComponent implements OnInit {
  readonly integrations = signal<Integration[]>([]);
  readonly transactions = signal<Transaction[]>([]);
  readonly reconciliation = signal<Reconciliation | null>(null);
  readonly columns = ['provider', 'type', 'amount', 'status', 'actions'];

  newProvider: AccountingProvider | '' = '';
  reconFrom = '';
  reconTo = '';

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.http.get<Integration[]>(`${environment.apiUrl}/accounting/integrations`).subscribe((data) => this.integrations.set(data));
    this.http.get<Transaction[]>(`${environment.apiUrl}/accounting/transactions`).subscribe((data) => this.transactions.set(data));
  }

  connectProvider(): void {
    this.http.post(`${environment.apiUrl}/accounting/integrations`, { provider: this.newProvider }).subscribe(() => {
      this.newProvider = '';
      this.load();
    });
  }

  sync(id: string): void {
    this.http.post(`${environment.apiUrl}/accounting/transactions/${id}/sync`, {}).subscribe(() => this.load());
  }

  runReconciliation(): void {
    this.http
      .get<Reconciliation>(`${environment.apiUrl}/accounting/reports/reconciliation`, {
        params: { from: this.reconFrom, to: this.reconTo },
      })
      .subscribe((data) => this.reconciliation.set(data));
  }
}

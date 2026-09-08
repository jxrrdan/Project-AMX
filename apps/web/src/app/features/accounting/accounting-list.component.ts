import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { environment } from '../../../environments/environment';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  integration: { provider: string };
}

@Component({
  selector: 'app-accounting-list',
  imports: [CurrencyPipe, MatTableModule, MatChipsModule],
  template: `
    <h1>Accounting Integration</h1>
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
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
  `,
  styles: [`table { width: 100%; }`],
})
export class AccountingListComponent implements OnInit {
  readonly transactions = signal<Transaction[]>([]);
  readonly columns = ['provider', 'type', 'amount', 'status'];

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.http.get<Transaction[]>(`${environment.apiUrl}/accounting/transactions`).subscribe((data) => this.transactions.set(data));
  }
}

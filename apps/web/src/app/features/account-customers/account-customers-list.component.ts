import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { environment } from '../../../environments/environment';

interface AccountCustomer {
  id: string;
  name: string;
  contactEmail: string | null;
  creditLimit: string;
  balance: string;
  active: boolean;
}

interface AgedDebtors {
  total: number;
  rows: { id: string; name: string; balance: number; ageDays: number; current: number; days30: number; days60: number; days90plus: number }[];
}

@Component({
  selector: 'app-account-customers-list',
  imports: [CurrencyPipe, FormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTableModule],
  template: `
    <div class="header">
      <h1>Account Customers</h1>
      <div>
        <button mat-stroked-button (click)="toggleAged()">{{ showAged() ? 'Hide' : 'Show' }} aged debtors</button>
        <button mat-flat-button color="primary" (click)="showForm.set(!showForm())"><mat-icon>add</mat-icon> New account</button>
      </div>
    </div>

    @if (showAged() && aged(); as a) {
      <mat-card class="aged">
        <h3>Aged debtors — {{ a.total | currency: 'GBP' }} outstanding</h3>
        <table mat-table [dataSource]="a.rows" class="mat-elevation-z1">
          <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Customer</th><td mat-cell *matCellDef="let r">{{ r.name }}</td></ng-container>
          <ng-container matColumnDef="current"><th mat-header-cell *matHeaderCellDef>Current</th><td mat-cell *matCellDef="let r">{{ r.current | currency: 'GBP' }}</td></ng-container>
          <ng-container matColumnDef="days30"><th mat-header-cell *matHeaderCellDef>30+</th><td mat-cell *matCellDef="let r">{{ r.days30 | currency: 'GBP' }}</td></ng-container>
          <ng-container matColumnDef="days60"><th mat-header-cell *matHeaderCellDef>60+</th><td mat-cell *matCellDef="let r">{{ r.days60 | currency: 'GBP' }}</td></ng-container>
          <ng-container matColumnDef="days90plus"><th mat-header-cell *matHeaderCellDef>90+</th><td mat-cell *matCellDef="let r">{{ r.days90plus | currency: 'GBP' }}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="agedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: agedColumns"></tr>
        </table>
      </mat-card>
    }

    @if (showForm()) {
      <mat-card class="form-card">
        <mat-form-field appearance="outline"><mat-label>Name</mat-label><input matInput [(ngModel)]="form.name" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Email</mat-label><input matInput [(ngModel)]="form.contactEmail" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Credit limit (£)</mat-label><input matInput type="number" [(ngModel)]="form.creditLimit" /></mat-form-field>
        <button mat-flat-button color="primary" [disabled]="!form.name" (click)="create()">Create account</button>
      </mat-card>
    }

    <table mat-table [dataSource]="customers()" class="mat-elevation-z1">
      <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Name</th><td mat-cell *matCellDef="let c"><a [routerLink]="['/account-customers', c.id]">{{ c.name }}</a></td></ng-container>
      <ng-container matColumnDef="balance"><th mat-header-cell *matHeaderCellDef>Balance</th><td mat-cell *matCellDef="let c" [class.owing]="+c.balance > 0">{{ +c.balance | currency: 'GBP' }}</td></ng-container>
      <ng-container matColumnDef="creditLimit"><th mat-header-cell *matHeaderCellDef>Credit limit</th><td mat-cell *matCellDef="let c">{{ +c.creditLimit | currency: 'GBP' }}</td></ng-container>
      <ng-container matColumnDef="active"><th mat-header-cell *matHeaderCellDef>Active</th><td mat-cell *matCellDef="let c">{{ c.active ? 'Yes' : 'No' }}</td></ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
    @if (!customers().length) { <p class="empty">No account customers yet.</p> }
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .header > div { display: flex; gap: 8px; }
    .form-card, .aged { padding: 16px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
    .form-card { max-width: 420px; }
    table { width: 100%; }
    a { color: #0066b1; text-decoration: none; }
    .owing { font-weight: 600; color: #c62828; }
    .empty { color: rgba(0,0,0,0.5); margin-top: 16px; }
  `],
})
export class AccountCustomersListComponent implements OnInit {
  readonly customers = signal<AccountCustomer[]>([]);
  readonly aged = signal<AgedDebtors | null>(null);
  readonly showForm = signal(false);
  readonly showAged = signal(false);
  readonly columns = ['name', 'balance', 'creditLimit', 'active'];
  readonly agedColumns = ['name', 'current', 'days30', 'days60', 'days90plus'];
  form = { name: '', contactEmail: '', creditLimit: null as number | null };

  private readonly http = inject(HttpClient);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.http.get<AccountCustomer[]>(`${environment.apiUrl}/account-customers`).subscribe((d) => this.customers.set(d));
  }

  toggleAged(): void {
    this.showAged.set(!this.showAged());
    if (this.showAged() && !this.aged()) {
      this.http.get<AgedDebtors>(`${environment.apiUrl}/account-customers/reports/aged-debtors`).subscribe((d) => this.aged.set(d));
    }
  }

  create(): void {
    this.http.post(`${environment.apiUrl}/account-customers`, {
      name: this.form.name,
      contactEmail: this.form.contactEmail || undefined,
      creditLimit: this.form.creditLimit != null ? Number(this.form.creditLimit) : undefined,
    }).subscribe(() => {
      this.form = { name: '', contactEmail: '', creditLimit: null };
      this.showForm.set(false);
      this.load();
    });
  }
}

import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../environments/environment';

interface Doc {
  generatedAt: string;
  sales: { pipeline: number; delivered: number; inProgress: number; usedStock: number };
  aftersales: { openJobCards: number; recallsOutstanding: number; motRemindersDue: number; serviceRemindersDue: number };
  parts: { stockValue: number; backordersOutstanding: number };
  finance: { cashTakenToday: number; agedDebtorsTotal: number; creditNotesIssued: number; creditNotesIssuedValue: number };
}

@Component({
  selector: 'app-doc-report',
  imports: [CurrencyPipe, DatePipe, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <div class="header">
      <h1>Daily Operating Control</h1>
      <button mat-stroked-button (click)="load()"><mat-icon>refresh</mat-icon> Refresh</button>
    </div>
    @if (doc(); as d) {
      <p class="ts">Generated {{ d.generatedAt | date: 'medium' }}</p>

      <h3>Sales</h3>
      <div class="tiles">
        <mat-card class="tile"><span class="num">{{ d.sales.pipeline }}</span><span>New-car pipeline</span></mat-card>
        <mat-card class="tile"><span class="num">{{ d.sales.inProgress }}</span><span>In progress</span></mat-card>
        <mat-card class="tile"><span class="num">{{ d.sales.delivered }}</span><span>Delivered</span></mat-card>
        <mat-card class="tile"><span class="num">{{ d.sales.usedStock }}</span><span>Used stock</span></mat-card>
      </div>

      <h3>Aftersales</h3>
      <div class="tiles">
        <mat-card class="tile"><span class="num">{{ d.aftersales.openJobCards }}</span><span>Open job cards (WIP)</span></mat-card>
        <mat-card class="tile warn"><span class="num">{{ d.aftersales.recallsOutstanding }}</span><span>Recalls outstanding</span></mat-card>
        <mat-card class="tile warn"><span class="num">{{ d.aftersales.motRemindersDue }}</span><span>MOT reminders due</span></mat-card>
        <mat-card class="tile warn"><span class="num">{{ d.aftersales.serviceRemindersDue }}</span><span>Service reminders due</span></mat-card>
      </div>

      <h3>Parts</h3>
      <div class="tiles">
        <mat-card class="tile"><span class="num">{{ d.parts.stockValue | currency: 'GBP' }}</span><span>Stock value</span></mat-card>
        <mat-card class="tile warn"><span class="num">{{ d.parts.backordersOutstanding }}</span><span>Backorders outstanding</span></mat-card>
      </div>

      <h3>Finance</h3>
      <div class="tiles">
        <mat-card class="tile ok"><span class="num">{{ d.finance.cashTakenToday | currency: 'GBP' }}</span><span>Cash taken today</span></mat-card>
        <mat-card class="tile warn"><span class="num">{{ d.finance.agedDebtorsTotal | currency: 'GBP' }}</span><span>Aged debtors</span></mat-card>
        <mat-card class="tile"><span class="num">{{ d.finance.creditNotesIssued }}</span><span>Credit notes issued</span></mat-card>
        <mat-card class="tile"><span class="num">{{ d.finance.creditNotesIssuedValue | currency: 'GBP' }}</span><span>Credit notes value</span></mat-card>
      </div>
    }
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; }
    .ts { color: var(--amx-text-secondary); margin-top: 0; }
    h3 { margin: 20px 0 8px; }
    .tiles { display: flex; gap: 12px; flex-wrap: wrap; }
    .tile { flex: 1; min-width: 150px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
    .tile .num { font-size: 24px; font-weight: 600; }
    .tile.warn .num { color: var(--amx-warning-fg); } .tile.ok .num { color: var(--amx-success-fg); }
  `],
})
export class DocReportComponent implements OnInit {
  readonly doc = signal<Doc | null>(null);
  private readonly http = inject(HttpClient);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.http.get<Doc>(`${environment.apiUrl}/reports/doc`).subscribe((d) => this.doc.set(d));
  }
}

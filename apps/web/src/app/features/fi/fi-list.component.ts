import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { environment } from '../../../environments/environment';

interface CommissionReport {
  totalCommission: number;
  dealCount: number;
  financePenetration: number;
  insuranceAttachment: number;
}

@Component({
  selector: 'app-fi-list',
  imports: [CurrencyPipe, MatCardModule],
  template: `
    <h1>Finance &amp; Insurance</h1>
    @if (report(); as r) {
      <div class="grid">
        <mat-card>
          <div class="label">Total commission</div>
          <div class="value">{{ r.totalCommission | currency: 'GBP' }}</div>
        </mat-card>
        <mat-card>
          <div class="label">Deals with F&amp;I</div>
          <div class="value">{{ r.dealCount }}</div>
        </mat-card>
        <mat-card>
          <div class="label">Finance penetration</div>
          <div class="value">{{ r.financePenetration }}</div>
        </mat-card>
        <mat-card>
          <div class="label">Insurance attachment</div>
          <div class="value">{{ r.insuranceAttachment }}</div>
        </mat-card>
      </div>
    }
  `,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
      }
      mat-card {
        padding: 16px;
      }
      .label {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
      }
      .value {
        font-size: 22px;
        font-weight: 600;
      }
    `,
  ],
})
export class FiListComponent implements OnInit {
  readonly report = signal<CommissionReport | null>(null);

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.http.get<CommissionReport>(`${environment.apiUrl}/fi/reports/commission`).subscribe((data) => this.report.set(data));
  }
}

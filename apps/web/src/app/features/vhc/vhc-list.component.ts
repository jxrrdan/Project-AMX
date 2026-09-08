import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

import { environment } from '../../../environments/environment';

interface VhcConversion {
  presented: number;
  approved: number;
  conversionRate: number;
}

@Component({
  selector: 'app-vhc-list',
  imports: [MatCardModule],
  template: `
    <h1>Digital Vehicle Health Check</h1>
    @if (stats(); as s) {
      <mat-card class="stats">
        <div><strong>{{ s.presented }}</strong> advisories presented</div>
        <div><strong>{{ s.approved }}</strong> approved</div>
        <div><strong>{{ (s.conversionRate * 100).toFixed(0) }}%</strong> conversion rate</div>
      </mat-card>
    }
    <p class="hint">
      Inspections are created from an active job card via the technician tablet flow
      (POST /vhc/inspections) — see Module 9 in the spec.
    </p>
  `,
  styles: [
    `
      .stats {
        display: flex;
        gap: 32px;
        padding: 16px;
        margin-bottom: 16px;
      }
      .hint {
        color: rgba(0, 0, 0, 0.5);
        font-size: 13px;
      }
    `,
  ],
})
export class VhcListComponent implements OnInit {
  readonly stats = signal<VhcConversion | null>(null);

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.http.get<VhcConversion>(`${environment.apiUrl}/vhc/reports/conversion-rate`).subscribe((data) => this.stats.set(data));
  }
}

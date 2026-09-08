import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';

interface DashboardKpis {
  pdi: { scheduled: number; complete: number };
  workshop: { utilisationPct: number; jobsToday: number; completeToday: number };
  usedCars: { inStock: number; soldMtd: number };
  crm: { openLeads: number; leadsByStage: Record<string, number>; conversionRateMtd: number };
  parts: { belowReorderLevel: number };
  warranty: { openClaims: number; awaitingAuthorisation: number };
}

@Component({
  selector: 'app-dashboard',
  imports: [MatCardModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <h1>Dealer Dashboard</h1>

    @if (briefing()) {
      <mat-card class="briefing">
        <mat-icon>auto_awesome</mat-icon>
        <p>{{ briefing() }}</p>
      </mat-card>
    }

    @if (kpis(); as k) {
      <div class="grid">
        <mat-card>
          <mat-icon>directions_car</mat-icon>
          <div class="label">PDIs today</div>
          <div class="value">{{ k.pdi.complete }} / {{ k.pdi.scheduled }}</div>
        </mat-card>
        <mat-card>
          <mat-icon>build</mat-icon>
          <div class="label">Workshop utilisation</div>
          <div class="value">{{ k.workshop.utilisationPct }}%</div>
        </mat-card>
        <mat-card>
          <mat-icon>car_repair</mat-icon>
          <div class="label">Used cars in stock</div>
          <div class="value">{{ k.usedCars.inStock }} (sold MTD: {{ k.usedCars.soldMtd }})</div>
        </mat-card>
        <mat-card>
          <mat-icon>contacts</mat-icon>
          <div class="label">Open leads</div>
          <div class="value">{{ k.crm.openLeads }}</div>
        </mat-card>
        <mat-card>
          <mat-icon>inventory_2</mat-icon>
          <div class="label">Parts below reorder level</div>
          <div class="value">{{ k.parts.belowReorderLevel }}</div>
        </mat-card>
        <mat-card>
          <mat-icon>verified</mat-icon>
          <div class="label">Open warranty claims</div>
          <div class="value">{{ k.warranty.openClaims }} ({{ k.warranty.awaitingAuthorisation }} awaiting auth)</div>
        </mat-card>
      </div>
    } @else {
      <mat-spinner diameter="32"></mat-spinner>
    }
  `,
  styles: [
    `
      .briefing {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 24px;
        padding: 16px;
        background: #eef4fb;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 16px;
      }
      mat-card {
        padding: 16px;
      }
      .label {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
        margin-top: 8px;
      }
      .value {
        font-size: 24px;
        font-weight: 600;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  readonly kpis = signal<DashboardKpis | null>(null);
  readonly briefing = signal<string | null>(null);

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.http.get<DashboardKpis>(`${environment.apiUrl}/dashboard/kpis`).subscribe((data) => this.kpis.set(data));
    this.http
      .get<{ summary: string }>(`${environment.apiUrl}/ai/daily-briefing`)
      .subscribe({ next: (data) => this.briefing.set(data.summary), error: () => undefined });
  }
}

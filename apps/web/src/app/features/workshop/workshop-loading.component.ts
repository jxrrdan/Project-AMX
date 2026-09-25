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

interface LoadingRow {
  bayId: string;
  bayName: string;
  date: string;
  capacityMinutes: number;
  bookedMinutes: number;
  utilisationPct: number | null;
}

interface PartShortfall {
  partId: string;
  partNumber: string;
  description: string;
  quantityOnHand: number;
  quantityRequired: number;
  shortfall: number;
  jobCardCount: number;
}

interface UnmatchedRequirement {
  description: string;
  quantity: number;
  jobCardId: string;
  customerName: string;
}

interface NoShowRiskRow {
  id: string;
  customerName: string;
  jobType: string;
  riskScore: number;
  reasons: string[];
}

/** "How full is the workshop" and "what parts do we need before the jobs on the books arrive" —
 * two views the job-card diary/kanban alone doesn't answer (see WorkshopService.loadingReport
 * and .upcomingPartsShortfalls). */
@Component({
  selector: 'app-workshop-loading',
  imports: [FormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTableModule],
  template: `
    <div class="header">
      <a mat-icon-button routerLink="/workshop"><mat-icon>arrow_back</mat-icon></a>
      <h1>Workshop loading &amp; parts</h1>
    </div>

    <mat-card class="section">
      <h3>Loading — booked hours vs capacity</h3>
      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>From</mat-label>
          <input matInput type="date" [(ngModel)]="from" (change)="loadLoading()" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>To</mat-label>
          <input matInput type="date" [(ngModel)]="to" (change)="loadLoading()" />
        </mat-form-field>
      </div>
      <table mat-table [dataSource]="loadingRows()" class="mat-elevation-z0">
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Date</th>
          <td mat-cell *matCellDef="let r">{{ r.date }}</td>
        </ng-container>
        <ng-container matColumnDef="bayName">
          <th mat-header-cell *matHeaderCellDef>Bay</th>
          <td mat-cell *matCellDef="let r">{{ r.bayName }}</td>
        </ng-container>
        <ng-container matColumnDef="booked">
          <th mat-header-cell *matHeaderCellDef>Booked</th>
          <td mat-cell *matCellDef="let r">{{ formatMinutes(r.bookedMinutes) }}</td>
        </ng-container>
        <ng-container matColumnDef="capacity">
          <th mat-header-cell *matHeaderCellDef>Capacity</th>
          <td mat-cell *matCellDef="let r">{{ r.capacityMinutes ? formatMinutes(r.capacityMinutes) : 'Not set' }}</td>
        </ng-container>
        <ng-container matColumnDef="utilisation">
          <th mat-header-cell *matHeaderCellDef>Utilisation</th>
          <td mat-cell *matCellDef="let r">
            @if (r.utilisationPct !== null) {
              <span [class.over]="r.utilisationPct > 100">{{ r.utilisationPct }}%</span>
            } @else {
              <span class="hint">—</span>
            }
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="loadingColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: loadingColumns"></tr>
      </table>
      @if (!loadingRows().length) {
        <p class="hint">No booked jobs or configured capacity in this date range.</p>
      }
    </mat-card>

    <mat-card class="section">
      <h3>Parts needed for upcoming jobs</h3>
      <p class="hint">Flags a shortage before the job's day arrives, based on parts logged against scheduled (not yet started) jobs.</p>
      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>Look ahead (days)</mat-label>
          <input matInput type="number" [(ngModel)]="lookAheadDays" (change)="loadShortfalls()" />
        </mat-form-field>
      </div>
      <table mat-table [dataSource]="shortfalls()" class="mat-elevation-z0">
        <ng-container matColumnDef="partNumber">
          <th mat-header-cell *matHeaderCellDef>Part</th>
          <td mat-cell *matCellDef="let s">{{ s.partNumber }} — {{ s.description }}</td>
        </ng-container>
        <ng-container matColumnDef="onHand">
          <th mat-header-cell *matHeaderCellDef>On hand</th>
          <td mat-cell *matCellDef="let s">{{ s.quantityOnHand }}</td>
        </ng-container>
        <ng-container matColumnDef="required">
          <th mat-header-cell *matHeaderCellDef>Required</th>
          <td mat-cell *matCellDef="let s">{{ s.quantityRequired }} (across {{ s.jobCardCount }} job(s))</td>
        </ng-container>
        <ng-container matColumnDef="shortfall">
          <th mat-header-cell *matHeaderCellDef>Shortfall</th>
          <td mat-cell *matCellDef="let s"><span class="over">{{ s.shortfall }}</span></td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="shortfallColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: shortfallColumns"></tr>
      </table>
      @if (!shortfalls().length) {
        <p class="hint">No shortfalls — stock covers everything logged against upcoming jobs.</p>
      }

      @if (unmatched().length) {
        <h4>Not yet matched to a stocked part</h4>
        @for (u of unmatched(); track u.jobCardId + u.description) {
          <div class="unmatched-row">{{ u.description }} x{{ u.quantity }} — <a [routerLink]="['/workshop/job-cards', u.jobCardId]">{{ u.customerName }}</a></div>
        }
      }
    </mat-card>

    <mat-card class="section">
      <h3>No-show risk — upcoming bookings</h3>
      <p class="hint">
        A deterministic risk score from signals actually on the booking (no phone number, no advisor assigned, booked
        far ahead, no vehicle registration captured) — not a chatbot guess.
      </p>
      @for (b of noShowRisk(); track b.id) {
        <div class="unmatched-row">
          <span class="risk" [class.risk-high]="b.riskScore >= 60">{{ b.riskScore }}</span>
          {{ b.customerName }} — {{ b.jobType }}
          @if (b.reasons.length) {
            <span class="hint"> ({{ b.reasons.join(', ') }})</span>
          }
        </div>
      } @empty {
        <p class="hint">No upcoming scheduled bookings.</p>
      }
    </mat-card>
  `,
  styles: [
    `
      .header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }
      .section {
        padding: 16px;
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .row {
        display: flex;
        gap: 12px;
      }
      .hint {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.55);
      }
      .over {
        color: #c62828;
        font-weight: 600;
      }
      .unmatched-row {
        font-size: 13px;
        padding: 4px 0;
      }
      .risk {
        display: inline-block;
        min-width: 28px;
        text-align: center;
        border-radius: 4px;
        background: #e8f5e9;
        padding: 1px 6px;
        font-weight: 600;
        margin-right: 6px;
      }
      .risk-high {
        background: #ffebee;
        color: #c62828;
      }
      table {
        width: 100%;
      }
    `,
  ],
})
export class WorkshopLoadingComponent implements OnInit {
  readonly loadingRows = signal<LoadingRow[]>([]);
  readonly shortfalls = signal<PartShortfall[]>([]);
  readonly unmatched = signal<UnmatchedRequirement[]>([]);
  readonly noShowRisk = signal<NoShowRiskRow[]>([]);
  readonly loadingColumns = ['date', 'bayName', 'booked', 'capacity', 'utilisation'];
  readonly shortfallColumns = ['partNumber', 'onHand', 'required', 'shortfall'];

  from = new Date().toISOString().slice(0, 10);
  to = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  lookAheadDays = 7;

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.loadLoading();
    this.loadShortfalls();
    this.loadNoShowRisk();
  }

  loadNoShowRisk(): void {
    this.http.get<NoShowRiskRow[]>(`${environment.apiUrl}/ai/service/no-show-risk`).subscribe((data) => this.noShowRisk.set(data));
  }

  loadLoading(): void {
    this.http
      .get<LoadingRow[]>(`${environment.apiUrl}/loading`, { params: { from: this.from, to: this.to } })
      .subscribe((data) => this.loadingRows.set(data));
  }

  loadShortfalls(): void {
    this.http
      .get<{ shortfalls: PartShortfall[]; unmatched: UnmatchedRequirement[] }>(`${environment.apiUrl}/job-cards/upcoming-part-shortfalls`, {
        params: { days: this.lookAheadDays },
      })
      .subscribe((data) => {
        this.shortfalls.set(data.shortfalls);
        this.unmatched.set(data.unmatched);
      });
  }

  formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  }
}

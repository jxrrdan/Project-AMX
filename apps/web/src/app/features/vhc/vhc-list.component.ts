import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { VhcRating } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface VhcConversion {
  presented: number;
  approved: number;
  conversionRate: number;
}

interface VhcInspection {
  id: string;
  vehicleReg: string;
  mileage: number | null;
  sentAt: string | null;
  createdAt: string;
  items: { rating: VhcRating }[];
}

interface JobCardOption {
  id: string;
  customerName: string;
  vehicleReg: string | null;
}

@Component({
  selector: 'app-vhc-list',
  imports: [DatePipe, RouterLink, FormsModule, MatCardModule, MatChipsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <div class="header">
      <h1>Digital Vehicle Health Check</h1>
      <button mat-flat-button color="primary" (click)="showForm.set(!showForm())">
        <mat-icon>add</mat-icon>
        New inspection
      </button>
    </div>

    @if (stats(); as s) {
      <mat-card class="stats">
        <div><strong>{{ s.presented }}</strong> advisories presented</div>
        <div><strong>{{ s.approved }}</strong> approved</div>
        <div><strong>{{ (s.conversionRate * 100).toFixed(0) }}%</strong> conversion rate</div>
      </mat-card>
    }

    @if (showForm()) {
      <mat-card class="form-card">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Job card</mat-label>
          <mat-select [(ngModel)]="form.jobCardId" (selectionChange)="onJobCardChange()">
            @for (j of jobCards(); track j.id) {
              <mat-option [value]="j.id">{{ j.customerName }} — {{ j.vehicleReg }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Vehicle reg</mat-label>
            <input matInput [(ngModel)]="form.vehicleReg" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Mileage</mat-label>
            <input matInput type="number" [(ngModel)]="form.mileage" />
          </mat-form-field>
        </div>
        <button mat-flat-button color="primary" [disabled]="!form.jobCardId || !form.vehicleReg" (click)="create()">
          Start inspection
        </button>
      </mat-card>
    }

    <div class="grid">
      @for (i of inspections(); track i.id) {
        <mat-card [routerLink]="['/vhc', i.id]" class="clickable">
          <div class="reg">{{ i.vehicleReg }}</div>
          <div class="date">{{ i.createdAt | date: 'd MMM yyyy' }}</div>
          <mat-chip-set>
            @for (item of i.items; track $index) {
              <mat-chip [class]="'rating-' + item.rating.toLowerCase()">{{ item.rating }}</mat-chip>
            }
          </mat-chip-set>
          @if (i.sentAt) {
            <div class="sent">Report sent</div>
          }
        </mat-card>
      }
    </div>
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .stats {
        display: flex;
        gap: 32px;
        padding: 16px;
        margin-bottom: 16px;
      }
      .form-card {
        padding: 16px;
        max-width: 500px;
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .row {
        display: flex;
        gap: 12px;
      }
      .row mat-form-field {
        flex: 1;
      }
      .full-width {
        width: 100%;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
      }
      mat-card {
        padding: 16px;
      }
      .clickable {
        cursor: pointer;
      }
      .reg {
        font-weight: 600;
      }
      .date {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.5);
        margin-bottom: 8px;
      }
      .sent {
        font-size: 11px;
        color: #2e7d32;
        margin-top: 8px;
      }
      .rating-green {
        background: #c8e6c9;
      }
      .rating-amber {
        background: #ffe0b2;
      }
      .rating-red {
        background: #ffcdd2;
      }
    `,
  ],
})
export class VhcListComponent implements OnInit {
  readonly stats = signal<VhcConversion | null>(null);
  readonly inspections = signal<VhcInspection[]>([]);
  readonly jobCards = signal<JobCardOption[]>([]);
  readonly showForm = signal(false);

  form = { jobCardId: '', vehicleReg: '', mileage: null as number | null };

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
    this.http.get<JobCardOption[]>(`${environment.apiUrl}/job-cards`).subscribe((data) => this.jobCards.set(data));
  }

  load(): void {
    this.http.get<VhcInspection[]>(`${environment.apiUrl}/vhc/inspections`).subscribe((data) => this.inspections.set(data));
    this.http.get<VhcConversion>(`${environment.apiUrl}/vhc/reports/conversion-rate`).subscribe((data) => this.stats.set(data));
  }

  onJobCardChange(): void {
    const job = this.jobCards().find((j) => j.id === this.form.jobCardId);
    if (job?.vehicleReg) {
      this.form.vehicleReg = job.vehicleReg;
    }
  }

  create(): void {
    this.http.post(`${environment.apiUrl}/vhc/inspections`, this.form).subscribe(() => {
      this.showForm.set(false);
      this.form = { jobCardId: '', vehicleReg: '', mileage: null };
      this.load();
    });
  }
}

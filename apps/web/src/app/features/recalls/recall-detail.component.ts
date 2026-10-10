import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import {
  RECALL_CAMPAIGN_STATUS_LABELS,
  RECALL_VEHICLE_STATUS_LABELS,
  RECALL_VEHICLE_WORKFLOW,
  RecallCampaignStatus,
  RecallVehicleStatus,
} from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface RecallVehicle {
  id: string;
  vin: string;
  registration: string | null;
  customerName: string | null;
  customerContact: string | null;
  status: RecallVehicleStatus;
  bookedDate: string | null;
  completedDate: string | null;
  notes: string | null;
}

interface Campaign {
  id: string;
  code: string;
  title: string;
  description: string | null;
  affectedModels: string | null;
  status: RecallCampaignStatus;
  vehicles: RecallVehicle[];
}

@Component({
  selector: 'app-recall-detail',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
  ],
  template: `
    @if (campaign(); as c) {
      <div class="header">
        <button mat-icon-button (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <span class="title">{{ c.code }} — {{ c.title }}</span>
        <mat-chip [class]="'status-' + c.status">{{ campaignStatusLabels[c.status] }}</mat-chip>
        <span class="spacer"></span>
        <button mat-stroked-button (click)="toggleStatus(c)">
          {{ c.status === 'OPEN' ? 'Close campaign' : 'Reopen campaign' }}
        </button>
      </div>
      @if (c.affectedModels) { <p class="subtitle">Affected models: {{ c.affectedModels }}</p> }
      @if (c.description) { <p class="desc">{{ c.description }}</p> }

      <mat-card class="section">
        <h3>Affected vehicles ({{ c.vehicles.length }})</h3>
        <table mat-table [dataSource]="c.vehicles" class="mat-elevation-z1">
          <ng-container matColumnDef="vin">
            <th mat-header-cell *matHeaderCellDef>VIN</th>
            <td mat-cell *matCellDef="let v">{{ v.vin }}</td>
          </ng-container>
          <ng-container matColumnDef="reg">
            <th mat-header-cell *matHeaderCellDef>Reg</th>
            <td mat-cell *matCellDef="let v">{{ v.registration || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="customer">
            <th mat-header-cell *matHeaderCellDef>Customer</th>
            <td mat-cell *matCellDef="let v">
              {{ v.customerName || '—' }}
              @if (v.customerContact) { <span class="muted">· {{ v.customerContact }}</span> }
            </td>
          </ng-container>
          <ng-container matColumnDef="dates">
            <th mat-header-cell *matHeaderCellDef>Progress</th>
            <td mat-cell *matCellDef="let v">
              @if (v.completedDate) { Completed {{ v.completedDate | date: 'shortDate' }} }
              @else if (v.bookedDate) { Booked {{ v.bookedDate | date: 'shortDate' }} }
              @else { — }
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let v">
              <mat-form-field appearance="outline" class="status-select" subscriptSizing="dynamic">
                <mat-select [ngModel]="v.status" (ngModelChange)="setStatus(v, $event)">
                  @for (s of workflow; track s) {
                    <mat-option [value]="s">{{ vehicleStatusLabels[s] }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="vehicleColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: vehicleColumns"></tr>
        </table>
        @if (!c.vehicles.length) { <p class="empty">No affected vehicles added yet.</p> }
      </mat-card>

      <mat-card class="section">
        <h3>Add affected vehicle</h3>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>VIN</mat-label>
            <input matInput [(ngModel)]="vForm.vin" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Reg</mat-label>
            <input matInput [(ngModel)]="vForm.registration" />
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Customer name</mat-label>
            <input matInput [(ngModel)]="vForm.customerName" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Contact</mat-label>
            <input matInput [(ngModel)]="vForm.customerContact" placeholder="phone or email" />
          </mat-form-field>
        </div>
        <button mat-flat-button color="primary" [disabled]="!vForm.vin" (click)="addVehicle(c.id)">
          <mat-icon>add</mat-icon> Add vehicle
        </button>
      </mat-card>
    }
  `,
  styles: [
    `
      .header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .title {
        font-size: 18px;
        font-weight: 600;
      }
      .spacer {
        flex: 1 1 auto;
      }
      .subtitle,
      .desc {
        color: var(--amx-text-secondary);
        margin: 4px 0 0 40px;
      }
      .section {
        padding: 16px;
        margin: 16px 0;
      }
      table {
        width: 100%;
      }
      .row {
        display: flex;
        gap: 12px;
      }
      .row mat-form-field {
        flex: 1;
      }
      .status-select {
        width: 150px;
      }
      .muted {
        color: var(--amx-text-tertiary);
      }
      .empty {
        color: var(--amx-text-tertiary);
      }
      .status-OPEN {
        background: var(--amx-info-bg);
      }
      .status-CLOSED {
        background: var(--amx-surface-sunken);
      }
    `,
  ],
})
export class RecallDetailComponent implements OnInit {
  readonly campaign = signal<Campaign | null>(null);
  readonly vehicleColumns = ['vin', 'reg', 'customer', 'dates', 'status'];
  readonly workflow = RECALL_VEHICLE_WORKFLOW;
  readonly campaignStatusLabels = RECALL_CAMPAIGN_STATUS_LABELS;
  readonly vehicleStatusLabels = RECALL_VEHICLE_STATUS_LABELS;

  vForm = { vin: '', registration: '', customerName: '', customerContact: '' };
  private id = '';

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.http.get<Campaign>(`${environment.apiUrl}/recalls/${this.id}`).subscribe((data) => this.campaign.set(data));
  }

  toggleStatus(c: Campaign): void {
    const status = c.status === RecallCampaignStatus.OPEN ? RecallCampaignStatus.CLOSED : RecallCampaignStatus.OPEN;
    this.http.patch(`${environment.apiUrl}/recalls/${c.id}`, { status }).subscribe(() => this.load());
  }

  setStatus(v: RecallVehicle, status: RecallVehicleStatus): void {
    if (v.status === status) {
      return;
    }
    this.http.patch(`${environment.apiUrl}/recall-vehicles/${v.id}`, { status }).subscribe(() => this.load());
  }

  addVehicle(campaignId: string): void {
    const body = {
      vin: this.vForm.vin,
      registration: this.vForm.registration || undefined,
      customerName: this.vForm.customerName || undefined,
      customerContact: this.vForm.customerContact || undefined,
    };
    this.http.post(`${environment.apiUrl}/recalls/${campaignId}/vehicles`, body).subscribe({
      next: () => {
        this.vForm = { vin: '', registration: '', customerName: '', customerContact: '' };
        this.load();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not add vehicle', 'Dismiss', { duration: 4000 }),
    });
  }

  back(): void {
    this.router.navigate(['/recalls']);
  }
}

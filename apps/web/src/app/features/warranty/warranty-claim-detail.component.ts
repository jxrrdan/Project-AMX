import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WARRANTY_CLAIM_WORKFLOW, WarrantyClaimStatus } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface OperationLine {
  id: string;
  operationCode: string;
  description: string;
  standardMinutes: number;
  cause: string | null;
  correction: string | null;
  complaint: string | null;
  labourWriteUp: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  clockEntries: { id: string; clockOn: string; clockOff: string | null }[];
}

interface ClaimDetail {
  id: string;
  customerName: string;
  faultDescription: string;
  status: WarrantyClaimStatus;
  rejectionReason: string | null;
  actualPayment: number | null;
  vehicle: { vin: string; model: string };
  operationLines: OperationLine[];
}

@Component({
  selector: 'app-warranty-claim-detail',
  imports: [
    RouterLink,
    FormsModule,
    MatCardModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    @if (claim(); as c) {
      <div class="header">
        <div>
          <h1>{{ c.vehicle.model }} ({{ c.vehicle.vin }})</h1>
          <p class="meta">{{ c.customerName }} · {{ c.faultDescription }}</p>
        </div>
        <a mat-stroked-button routerLink="/warranty">
          <mat-icon>arrow_back</mat-icon>
          All claims
        </a>
      </div>

      <mat-card class="status-card">
        <mat-chip>{{ c.status }}</mat-chip>
        <mat-form-field appearance="outline">
          <mat-label>Move to</mat-label>
          <mat-select [(ngModel)]="nextStatus">
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ s }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (nextStatus === 'REJECTED') {
          <mat-form-field appearance="outline">
            <mat-label>Rejection reason</mat-label>
            <input matInput [(ngModel)]="rejectionReason" />
          </mat-form-field>
        }
        @if (nextStatus === 'PAID') {
          <mat-form-field appearance="outline">
            <mat-label>Actual payment (£)</mat-label>
            <input matInput type="number" [(ngModel)]="actualPayment" />
          </mat-form-field>
        }
        <button mat-flat-button color="primary" [disabled]="!nextStatus" (click)="updateStatus()">Update status</button>
        @if (c.rejectionReason) {
          <p class="rejection">Rejected: {{ c.rejectionReason }}</p>
        }
      </mat-card>

      <mat-card class="add-line-card">
        <h3>Add an operation line</h3>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Operation code</mat-label>
            <input matInput [(ngModel)]="lineForm.operationCode" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Description</mat-label>
            <input matInput [(ngModel)]="lineForm.description" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Standard minutes</mat-label>
            <input matInput type="number" [(ngModel)]="lineForm.standardMinutes" />
          </mat-form-field>
          <button mat-flat-button color="primary" [disabled]="!lineForm.operationCode || !lineForm.description" (click)="addLine()">
            Add
          </button>
        </div>
      </mat-card>

      @for (line of c.operationLines; track line.id) {
        <mat-card class="line-card">
          <div class="line-header">
            <span class="code">{{ line.operationCode }}</span>
            <span>{{ line.description }}</span>
            <span class="minutes">{{ line.standardMinutes }} min standard</span>
            @if (line.approvedAt) {
              <mat-chip>Approved by {{ line.approvedBy }}</mat-chip>
            } @else {
              <button mat-button (click)="approveLine(line.id)">Approve</button>
            }
          </div>

          <div class="clock-row">
            @if (openClockEntry(line)) {
              <button mat-stroked-button (click)="clockOff(line.id)">Clock off</button>
            } @else {
              <button mat-stroked-button (click)="clockOn(line.id)">Clock on</button>
            }
            <span class="clock-count">{{ line.clockEntries.length }} clocking(s)</span>
          </div>

          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Complaint</mat-label>
              <input matInput [ngModel]="line.complaint" (ngModelChange)="line.complaint = $event" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Cause</mat-label>
              <input matInput [ngModel]="line.cause" (ngModelChange)="line.cause = $event" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Correction</mat-label>
              <input matInput [ngModel]="line.correction" (ngModelChange)="line.correction = $event" />
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Technician labour write-up</mat-label>
            <textarea matInput rows="2" [ngModel]="line.labourWriteUp" (ngModelChange)="line.labourWriteUp = $event"></textarea>
          </mat-form-field>
          <button mat-button (click)="saveLine(line)">Save 3Cs &amp; write-up</button>
        </mat-card>
      }
    }
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
      }
      .meta {
        color: rgba(0, 0, 0, 0.6);
      }
      mat-card {
        padding: 16px;
        margin-bottom: 16px;
      }
      .status-card {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .rejection {
        color: #c62828;
        width: 100%;
        margin: 0;
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .row mat-form-field {
        flex: 1;
        min-width: 150px;
      }
      .full-width {
        width: 100%;
      }
      .line-card {
        border-left: 4px solid #0066b1;
      }
      .line-header {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 8px;
        flex-wrap: wrap;
      }
      .code {
        font-weight: 600;
      }
      .minutes {
        color: rgba(0, 0, 0, 0.5);
        font-size: 12px;
      }
      .clock-row {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 8px;
      }
      .clock-count {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.5);
      }
    `,
  ],
})
export class WarrantyClaimDetailComponent implements OnInit {
  readonly claim = signal<ClaimDetail | null>(null);
  readonly statuses = WARRANTY_CLAIM_WORKFLOW;

  nextStatus = '';
  rejectionReason = '';
  actualPayment: number | null = null;

  lineForm = { operationCode: '', description: '', standardMinutes: null as number | null };

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private claimId = '';

  ngOnInit(): void {
    this.claimId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.http.get<ClaimDetail>(`${environment.apiUrl}/warranty-claims/${this.claimId}`).subscribe((data) => this.claim.set(data));
  }

  openClockEntry(line: OperationLine): boolean {
    return line.clockEntries.some((e) => !e.clockOff);
  }

  addLine(): void {
    this.http.post(`${environment.apiUrl}/warranty-claims/${this.claimId}/operation-lines`, this.lineForm).subscribe(() => {
      this.lineForm = { operationCode: '', description: '', standardMinutes: null };
      this.load();
    });
  }

  saveLine(line: OperationLine): void {
    this.http
      .patch(`${environment.apiUrl}/warranty-claims/operation-lines/${line.id}`, {
        cause: line.cause,
        correction: line.correction,
        complaint: line.complaint,
        labourWriteUp: line.labourWriteUp,
      })
      .subscribe(() => this.load());
  }

  clockOn(lineId: string): void {
    this.http.post(`${environment.apiUrl}/warranty-claims/operation-lines/${lineId}/clock-on`, {}).subscribe(() => this.load());
  }

  clockOff(lineId: string): void {
    this.http.post(`${environment.apiUrl}/warranty-claims/operation-lines/${lineId}/clock-off`, {}).subscribe(() => this.load());
  }

  approveLine(lineId: string): void {
    this.http.post(`${environment.apiUrl}/warranty-claims/operation-lines/${lineId}/approve`, {}).subscribe(() => this.load());
  }

  updateStatus(): void {
    this.http
      .patch(`${environment.apiUrl}/warranty-claims/${this.claimId}/status`, {
        status: this.nextStatus,
        rejectionReason: this.nextStatus === 'REJECTED' ? this.rejectionReason : undefined,
        actualPayment: this.nextStatus === 'PAID' ? this.actualPayment : undefined,
      })
      .subscribe({
        next: () => {
          this.nextStatus = '';
          this.load();
        },
        error: (err) =>
          this.snackBar.open(err.error?.message ?? 'Could not update status', 'Dismiss', { duration: 4000 }),
      });
  }
}

import { CurrencyPipe } from '@angular/common';
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
import { VHC_INSPECTION_STATUS_LABELS, VhcInspectionStatus, VhcRating } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface VhcItem {
  id: string;
  category: string;
  label: string;
  rating: VhcRating;
  description: string | null;
  photoUrls: string[];
  estimatedLabourMinutes: number | null;
  estimatedPartsCost: number | null;
  approved: boolean | null;
}

interface InspectionDetail {
  id: string;
  vehicleReg: string;
  mileage: number | null;
  status: VhcInspectionStatus;
  completedAt: string | null;
  sentAt: string | null;
  items: VhcItem[];
}

@Component({
  selector: 'app-vhc-inspection-detail',
  imports: [
    CurrencyPipe,
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
    @if (inspection(); as i) {
      <div class="header">
        <div>
          <h1>VHC — {{ i.vehicleReg }} <mat-chip>{{ statusLabels[i.status] }}</mat-chip></h1>
          <p class="meta">{{ i.mileage }} miles @if (i.sentAt) {<span> · Report sent</span>}</p>
        </div>
        <a mat-stroked-button routerLink="/vhc">
          <mat-icon>arrow_back</mat-icon>
          All inspections
        </a>
      </div>

      <mat-card class="add-item-card">
        <h3>Add an item</h3>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Category</mat-label>
            <input matInput [(ngModel)]="itemForm.category" placeholder="Tyres" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Item</mat-label>
            <input matInput [(ngModel)]="itemForm.label" placeholder="Front nearside tyre" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Rating</mat-label>
            <mat-select [(ngModel)]="itemForm.rating">
              <mat-option value="GREEN">Green (OK)</mat-option>
              <mat-option value="AMBER">Amber (advisory)</mat-option>
              <mat-option value="RED">Red (action required)</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description</mat-label>
          <textarea matInput rows="2" [(ngModel)]="itemForm.description"></textarea>
        </mat-form-field>
        @if (itemForm.rating !== 'GREEN') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Photo URL (required for Amber/Red — paste a link since there's no camera here)</mat-label>
            <input matInput [(ngModel)]="itemForm.photoUrl" placeholder="https://..." />
          </mat-form-field>
        }
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Est. labour (min)</mat-label>
            <input matInput type="number" [(ngModel)]="itemForm.estimatedLabourMinutes" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Est. parts cost (£)</mat-label>
            <input matInput type="number" [(ngModel)]="itemForm.estimatedPartsCost" />
          </mat-form-field>
        </div>
        <button mat-flat-button color="primary" [disabled]="!itemForm.category || !itemForm.label" (click)="addItem()">
          Add item
        </button>
      </mat-card>

      <mat-card class="send-card">
        <h3>Technician sign-off</h3>
        @if (i.completedAt) {
          <p class="hint">Signed off — ready to send.</p>
        } @else {
          <p class="hint">Sign off once every item has been added — required before the report can be sent.</p>
          <button mat-stroked-button [disabled]="!i.items.length" (click)="completeInspection()">Sign off inspection</button>
        }

        <h3>Send report to customer</h3>
        <div class="row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Customer email</mat-label>
            <input matInput type="email" [(ngModel)]="customerEmail" />
          </mat-form-field>
          <button mat-flat-button color="primary" [disabled]="!customerEmail || !i.completedAt" (click)="sendReport()">Send</button>
        </div>
        <p class="hint">
          Public report link: <button mat-button (click)="copyLink()">{{ reportUrl() }}</button>
        </p>
      </mat-card>

      <div class="items-grid">
        @for (item of i.items; track item.id) {
          <mat-card [class]="'item-card rating-' + item.rating.toLowerCase()">
            <div class="item-header">
              <span class="category">{{ item.category }}</span>
              <mat-chip>{{ item.rating }}</mat-chip>
            </div>
            <div class="label">{{ item.label }}</div>
            @if (item.description) {
              <p>{{ item.description }}</p>
            }
            @if (item.estimatedPartsCost || item.estimatedLabourMinutes) {
              <p class="estimate">
                {{ item.estimatedLabourMinutes }} min labour · {{ item.estimatedPartsCost | currency: 'GBP' }} parts
              </p>
            }
            @if (item.approved === true) {
              <mat-chip>Approved by customer</mat-chip>
            } @else if (item.approved === false) {
              <mat-chip>Declined by customer</mat-chip>
            }
          </mat-card>
        }
      </div>
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
      .hint {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.5);
        word-break: break-all;
      }
      .items-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 16px;
      }
      .item-card {
        border-left: 4px solid #ccc;
      }
      .item-card.rating-green {
        border-left-color: #2e7d32;
      }
      .item-card.rating-amber {
        border-left-color: #ef6c00;
      }
      .item-card.rating-red {
        border-left-color: #c62828;
      }
      .item-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
      }
      .category {
        font-size: 11px;
        color: rgba(0, 0, 0, 0.5);
        text-transform: uppercase;
      }
      .label {
        font-weight: 600;
      }
      .estimate {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
      }
    `,
  ],
})
export class VhcInspectionDetailComponent implements OnInit {
  readonly inspection = signal<InspectionDetail | null>(null);
  readonly statusLabels = VHC_INSPECTION_STATUS_LABELS;
  customerEmail = '';

  itemForm = {
    category: '',
    label: '',
    rating: 'GREEN' as string,
    description: '',
    photoUrl: '',
    estimatedLabourMinutes: null as number | null,
    estimatedPartsCost: null as number | null,
  };

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private inspectionId = '';

  ngOnInit(): void {
    this.inspectionId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.http.get<InspectionDetail>(`${environment.apiUrl}/vhc/inspections/${this.inspectionId}`).subscribe((data) => this.inspection.set(data));
  }

  reportUrl(): string {
    return `${window.location.origin}/vhc-report/${this.inspectionId}`;
  }

  copyLink(): void {
    navigator.clipboard?.writeText(this.reportUrl());
    this.snackBar.open('Link copied', 'Dismiss', { duration: 2000 });
  }

  addItem(): void {
    const { photoUrl, ...rest } = this.itemForm;
    this.http
      .post(`${environment.apiUrl}/vhc/inspections/${this.inspectionId}/items`, {
        ...rest,
        photoUrls: photoUrl ? [photoUrl] : [],
      })
      .subscribe({
        next: () => {
          this.itemForm = {
            category: '',
            label: '',
            rating: 'GREEN',
            description: '',
            photoUrl: '',
            estimatedLabourMinutes: null,
            estimatedPartsCost: null,
          };
          this.load();
        },
        error: () => this.snackBar.open('A photo is required for Amber/Red items', 'Dismiss', { duration: 3000 }),
      });
  }

  completeInspection(): void {
    this.http.post(`${environment.apiUrl}/vhc/inspections/${this.inspectionId}/complete`, {}).subscribe({
      next: () => this.load(),
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not sign off inspection', 'Dismiss', { duration: 4000 }),
    });
  }

  sendReport(): void {
    this.http.post(`${environment.apiUrl}/vhc/inspections/${this.inspectionId}/send`, { customerEmail: this.customerEmail }).subscribe({
      next: () => {
        this.snackBar.open('Report sent (see the console-log email adapter output)', 'Dismiss', { duration: 4000 });
        this.load();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not send report', 'Dismiss', { duration: 4000 }),
    });
  }
}

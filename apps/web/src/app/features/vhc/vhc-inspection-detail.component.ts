import { CurrencyPipe, DatePipe } from '@angular/common';
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
import {
  VHC_CONTACT_METHOD_LABELS,
  VHC_INSPECTION_STATUS_LABELS,
  VHC_ITEM_RESPONSE_LABELS,
  VhcContactMethod,
  VhcInspectionStatus,
  VhcItemResponseStatus,
  VhcRating,
} from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface LinkedPart {
  id: string;
  quantity: number;
  part: { id: string; partNumber: string; description: string; costPrice: number };
}

interface VhcItem {
  id: string;
  category: string;
  label: string;
  rating: VhcRating;
  description: string | null;
  photoUrls: string[];
  estimatedLabourMinutes: number | null;
  estimatedPartsCost: number | null;
  quotedLabourCost: number | null;
  quotedPartsCost: number | null;
  quotedTotal: number | null;
  parts: LinkedPart[];
  response: VhcItemResponseStatus;
}

interface PartOption {
  id: string;
  partNumber: string;
  description: string;
  costPrice: number;
}

interface InspectionDetail {
  id: string;
  vehicleReg: string;
  mileage: number | null;
  status: VhcInspectionStatus;
  recordedAt: string | null;
  videoUrl: string | null;
  notifiedServiceAdvisorAt: string | null;
  sentAt: string | null;
  contactedAt: string | null;
  contactMethod: VhcContactMethod | null;
  contactNotes: string | null;
  items: VhcItem[];
}

/** Technician/advisor-facing VHC workflow: technician records items + video, which notifies the
 * job card's assigned service advisor; the advisor prices up parts/labour (already surfaced as an
 * auto-quote per item) and either emails the report or logs a phone call; either the customer (on
 * the public report) or the advisor (on the customer's behalf over the phone) can then approve,
 * decline, or defer each Amber/Red item. */
@Component({
  selector: 'app-vhc-inspection-detail',
  imports: [
    CurrencyPipe,
    DatePipe,
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
          <p class="meta">
            {{ i.mileage }} miles
            @if (i.sentAt) {<span> · Emailed {{ i.sentAt | date: 'dd MMM HH:mm' }}</span>}
            @if (i.contactedAt) {<span> · Phoned {{ i.contactedAt | date: 'dd MMM HH:mm' }}</span>}
          </p>
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
        <h3>Record inspection</h3>
        @if (i.recordedAt) {
          <p class="hint">Recorded {{ i.recordedAt | date: 'dd MMM HH:mm' }}.</p>
          @if (i.videoUrl) {
            <p class="hint">Video: <a [href]="i.videoUrl" target="_blank" rel="noopener">{{ i.videoUrl }}</a></p>
          }
          @if (i.notifiedServiceAdvisorAt) {
            <p class="hint advisor-ok">Service advisor notified {{ i.notifiedServiceAdvisorAt | date: 'dd MMM HH:mm' }}.</p>
          } @else {
            <p class="hint advisor-warn">No service advisor assigned to this job — nobody was notified. Assign one on the job card.</p>
          }
        } @else {
          <p class="hint">Mark as recorded once the video and every item has been added — this notifies the assigned service advisor and is required before the report can be sent.</p>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Video link (optional)</mat-label>
            <input matInput [(ngModel)]="videoUrl" placeholder="https://..." />
          </mat-form-field>
          <button mat-stroked-button [disabled]="!i.items.length" (click)="recordInspection()">Mark as recorded</button>
        }

        <h3>Contact the customer</h3>
        <div class="row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Customer email</mat-label>
            <input matInput type="email" [(ngModel)]="customerEmail" />
          </mat-form-field>
          <button mat-flat-button color="primary" [disabled]="!customerEmail || !i.recordedAt" (click)="sendReport()">Email report</button>
        </div>
        <div class="row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Or log a phone call instead</mat-label>
            <textarea matInput rows="2" [(ngModel)]="callNotes" placeholder="What was discussed/agreed on the call"></textarea>
          </mat-form-field>
          <button mat-stroked-button [disabled]="!i.recordedAt" (click)="logPhoneContact()">Log call</button>
        </div>
        @if (i.contactMethod) {
          <p class="hint">Last contacted by {{ contactMethodLabels[i.contactMethod] }}. @if (i.contactNotes) { — "{{ i.contactNotes }}" }</p>
        }
        <p class="hint">
          Public report link: <button mat-button (click)="copyLink()">{{ reportUrl() }}</button>
        </p>
      </mat-card>

      @for (rating of ratingOrder; track rating) {
        @if (itemsByRating(i, rating).length) {
          <div class="rating-group-header">
            <h3>{{ ratingHeading[rating] }}</h3>
            @if (rating !== 'GREEN') {
              <span class="subtotal">Identified work: {{ ratingSubtotal(i, rating) | currency: 'GBP' }}</span>
            }
          </div>
          <div class="items-grid">
            @for (item of itemsByRating(i, rating); track item.id) {
              <mat-card [class]="'item-card rating-' + item.rating.toLowerCase()">
                <div class="item-header">
                  <span class="category">{{ item.category }}</span>
                  <mat-chip>{{ item.rating }}</mat-chip>
                </div>
                <div class="label">{{ item.label }}</div>
                @if (item.description) {
                  <p>{{ item.description }}</p>
                }
                @if (item.quotedTotal !== null) {
                  <p class="estimate">
                    Quote: {{ item.quotedLabourCost | currency: 'GBP' }} labour + {{ item.quotedPartsCost | currency: 'GBP' }} parts =
                    <b>{{ item.quotedTotal | currency: 'GBP' }}</b>
                  </p>
                }
                @for (link of item.parts; track link.id) {
                  <div class="line-item">
                    <span>{{ link.part.partNumber }} — {{ link.part.description }} x{{ link.quantity }}</span>
                    <button mat-icon-button (click)="removeItemPart(link.id)"><mat-icon>close</mat-icon></button>
                  </div>
                }
                <div class="row part-picker">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Link a real part (uses its actual price in the quote)</mat-label>
                    <mat-select [(ngModel)]="partFormFor(item.id).partId">
                      @for (p of availableParts(); track p.id) {
                        <mat-option [value]="p.id">{{ p.partNumber }} — {{ p.description }} ({{ p.costPrice | currency: 'GBP' }})</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="qty">
                    <mat-label>Qty</mat-label>
                    <input matInput type="number" [(ngModel)]="partFormFor(item.id).quantity" />
                  </mat-form-field>
                  <button mat-icon-button [disabled]="!partFormFor(item.id).partId" (click)="addItemPart(item.id)">
                    <mat-icon>add</mat-icon>
                  </button>
                </div>
                @if (item.response !== 'PENDING') {
                  <mat-chip [class]="'response-' + item.response.toLowerCase()">{{ responseLabels[item.response] }}</mat-chip>
                } @else {
                  <div class="response-actions">
                    <button mat-button (click)="respond(item.id, Response.APPROVED)">Approve</button>
                    <button mat-button (click)="respond(item.id, Response.DECLINED)">Decline</button>
                    <button mat-button (click)="respond(item.id, Response.DEFERRED)">Defer</button>
                    <button mat-icon-button (click)="removeItem(item.id)" title="Delete — logged in error">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                }
              </mat-card>
            }
          </div>
        }
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
      .advisor-ok {
        color: #2e7d32;
      }
      .advisor-warn {
        color: #c62828;
      }
      .rating-group-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin: 8px 0;
      }
      .subtotal {
        font-size: 13px;
        font-weight: 600;
        color: rgba(0, 0, 0, 0.7);
      }
      .items-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 16px;
        margin-bottom: 16px;
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
      .line-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #eee;
        padding: 4px 0;
        font-size: 12px;
      }
      .part-picker {
        margin-top: 4px;
      }
      .qty {
        width: 70px;
      }
      .response-actions {
        display: flex;
        gap: 4px;
        align-items: center;
        margin-top: 4px;
      }
      .response-approved {
        background: #e8f5e9;
      }
      .response-declined {
        background: #fbe9e7;
      }
      .response-deferred {
        background: #fff8e1;
      }
    `,
  ],
})
export class VhcInspectionDetailComponent implements OnInit {
  readonly inspection = signal<InspectionDetail | null>(null);
  readonly availableParts = signal<PartOption[]>([]);
  readonly statusLabels = VHC_INSPECTION_STATUS_LABELS;
  readonly responseLabels = VHC_ITEM_RESPONSE_LABELS;
  readonly Response = VhcItemResponseStatus;
  readonly contactMethodLabels = VHC_CONTACT_METHOD_LABELS;
  readonly ratingOrder: VhcRating[] = [VhcRating.RED, VhcRating.AMBER, VhcRating.GREEN];
  readonly ratingHeading: Record<VhcRating, string> = {
    [VhcRating.RED]: 'Red work — action required',
    [VhcRating.AMBER]: 'Amber work — advisory',
    [VhcRating.GREEN]: 'Passed',
  };
  customerEmail = '';
  videoUrl = '';
  callNotes = '';

  private readonly partForms = new Map<string, { partId: string; quantity: number }>();

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
    this.http.get<PartOption[]>(`${environment.apiUrl}/parts`).subscribe((data) => this.availableParts.set(data));
  }

  partFormFor(itemId: string): { partId: string; quantity: number } {
    let form = this.partForms.get(itemId);
    if (!form) {
      form = { partId: '', quantity: 1 };
      this.partForms.set(itemId, form);
    }
    return form;
  }

  itemsByRating(i: InspectionDetail, rating: VhcRating): VhcItem[] {
    return i.items.filter((item) => item.rating === rating);
  }

  ratingSubtotal(i: InspectionDetail, rating: VhcRating): number {
    return this.itemsByRating(i, rating).reduce((sum, item) => sum + (item.quotedTotal ?? 0), 0);
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

  addItemPart(itemId: string): void {
    const form = this.partFormFor(itemId);
    if (!form.partId) return;
    this.http
      .post(`${environment.apiUrl}/vhc/items/${itemId}/parts`, { partId: form.partId, quantity: form.quantity || 1 })
      .subscribe({
        next: () => {
          this.partForms.delete(itemId);
          this.load();
        },
        error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not link part', 'Dismiss', { duration: 4000 }),
      });
  }

  removeItemPart(linkId: string): void {
    this.http.delete(`${environment.apiUrl}/vhc/item-parts/${linkId}`).subscribe({
      next: () => this.load(),
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not remove part', 'Dismiss', { duration: 4000 }),
    });
  }

  recordInspection(): void {
    this.http
      .post(`${environment.apiUrl}/vhc/inspections/${this.inspectionId}/record`, { videoUrl: this.videoUrl || undefined })
      .subscribe({
        next: () => this.load(),
        error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not record inspection', 'Dismiss', { duration: 4000 }),
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

  logPhoneContact(): void {
    this.http.post(`${environment.apiUrl}/vhc/inspections/${this.inspectionId}/log-call`, { notes: this.callNotes || undefined }).subscribe({
      next: () => {
        this.callNotes = '';
        this.snackBar.open('Phone call logged', 'Dismiss', { duration: 3000 });
        this.load();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not log call', 'Dismiss', { duration: 4000 }),
    });
  }

  respond(itemId: string, response: VhcItemResponseStatus): void {
    this.http.patch(`${environment.apiUrl}/vhc/items/${itemId}/advisor-respond`, { response }).subscribe({
      next: () => this.load(),
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not save response', 'Dismiss', { duration: 4000 }),
    });
  }

  removeItem(itemId: string): void {
    this.http.delete(`${environment.apiUrl}/vhc/items/${itemId}`).subscribe({
      next: () => this.load(),
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not delete item', 'Dismiss', { duration: 4000 }),
    });
  }
}

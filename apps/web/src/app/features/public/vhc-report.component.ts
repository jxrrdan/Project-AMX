import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { VhcRating } from '@project-amx/shared';
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
  quotedLabourCost: number | null;
  quotedPartsCost: number | null;
  quotedTotal: number | null;
  approved: boolean | null;
}

interface VhcInspectionPublic {
  id: string;
  vehicleReg: string;
  mileage: number | null;
  items: VhcItem[];
}

/**
 * The customer-facing VHC report (Feature Spec §9.2-9.3) — "delivered via email link ... no
 * login required". A customer clicks the link from their health-check email and lands here to
 * approve or decline each flagged item; approved items are added as job lines automatically.
 */
@Component({
  selector: 'app-vhc-report',
  imports: [CurrencyPipe, MatCardModule, MatChipsModule, MatButtonModule],
  template: `
    <div class="page">
      <div class="content">
        @if (inspection(); as i) {
          <h1>Your Vehicle Health Check</h1>
          <p class="subtitle">{{ i.vehicleReg }} · {{ i.mileage }} miles</p>

          @for (item of i.items; track item.id) {
            <mat-card [class]="'item-card rating-' + item.rating.toLowerCase()">
              <div class="item-header">
                <span class="category">{{ item.category }}</span>
                <mat-chip>{{ item.rating === 'GREEN' ? 'Passed' : item.rating }}</mat-chip>
              </div>
              <div class="label">{{ item.label }}</div>
              @if (item.description) {
                <p>{{ item.description }}</p>
              }
              @if (item.photoUrls.length) {
                <img [src]="item.photoUrls[0]" alt="Condition photo" class="photo" />
              }
              @if (item.rating !== 'GREEN') {
                @if (item.quotedTotal !== null) {
                  <p class="estimate">
                    Quote: {{ item.quotedLabourCost | currency: 'GBP' }} labour + {{ item.quotedPartsCost | currency: 'GBP' }} parts =
                    <b>{{ item.quotedTotal | currency: 'GBP' }}</b>
                  </p>
                }
                @if (item.approved === null) {
                  <div class="actions">
                    <button mat-flat-button color="primary" (click)="respond(item, true)">Approve</button>
                    <button mat-stroked-button (click)="respond(item, false)">Decline</button>
                  </div>
                } @else {
                  <p class="responded">{{ item.approved ? 'You approved this item' : 'You declined this item' }}</p>
                }
              }
            </mat-card>
          }
        } @else if (notFound()) {
          <p>This report could not be found — the link may have expired.</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .page {
        display: flex;
        justify-content: center;
        padding: 32px 16px;
        min-height: 100vh;
        background: #f5f6f8;
      }
      .content {
        width: 100%;
        max-width: 560px;
      }
      .subtitle {
        color: rgba(0, 0, 0, 0.6);
        margin-top: -8px;
      }
      mat-card {
        padding: 16px;
        margin-bottom: 16px;
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
      .photo {
        max-width: 100%;
        border-radius: 8px;
        margin-top: 8px;
      }
      .estimate {
        font-size: 13px;
        color: rgba(0, 0, 0, 0.7);
      }
      .actions {
        display: flex;
        gap: 12px;
        margin-top: 8px;
      }
      .responded {
        font-size: 13px;
        color: #2e7d32;
        font-weight: 600;
      }
    `,
  ],
})
export class VhcReportComponent implements OnInit {
  readonly inspection = signal<VhcInspectionPublic | null>(null);
  readonly notFound = signal(false);

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.http.get<VhcInspectionPublic>(`${environment.apiUrl}/vhc/inspections/${id}/report`).subscribe({
      next: (data) => this.inspection.set(data),
      error: () => this.notFound.set(true),
    });
  }

  respond(item: VhcItem, approved: boolean): void {
    this.http.patch(`${environment.apiUrl}/vhc/items/${item.id}/respond`, { approved }).subscribe(() => {
      item.approved = approved;
    });
  }
}

import { CurrencyPipe, DecimalPipe } from '@angular/common';
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
import { UsedVehicleStatus } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface AccessoryLine {
  description: string;
  price: number | null;
}

interface UsedVehicleDetail {
  id: string;
  reg: string;
  make: string;
  model: string;
  colour: string | null;
  mileage: number | null;
  askingPrice: number | null;
  purchasePrice: number | null;
  status: UsedVehicleStatus;
  priceHistory: { price: number; changedAt: string }[];
  appraisal: { condition: string | null; mileage: number | null; damageNotes: string | null; agreedValue: number } | null;
  dealSheet: {
    sellingPrice: number;
    accessoriesTotal: number;
    grossProfit: number | null;
    pdfUrl: string | null;
    accessoryLines: { description: string; price: number }[];
  } | null;
}

@Component({
  selector: 'app-used-car-detail',
  imports: [
    CurrencyPipe,
    DecimalPipe,
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
    @if (vehicle(); as v) {
      <div class="header">
        <div>
          <h1>{{ v.make }} {{ v.model }}</h1>
          <p class="meta">{{ v.reg }} · {{ v.colour }} · {{ v.mileage | number }} miles</p>
        </div>
        <a mat-stroked-button routerLink="/used-cars">
          <mat-icon>arrow_back</mat-icon>
          All stock
        </a>
      </div>

      <div class="columns">
        <div class="col">
          <mat-card>
            <h3>Status &amp; pricing</h3>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="statusValue" (selectionChange)="updateStatus()">
                @for (s of statuses; track s) {
                  <mat-option [value]="s">{{ s }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <div class="row">
              <mat-form-field appearance="outline">
                <mat-label>Asking price (£)</mat-label>
                <input matInput type="number" [(ngModel)]="askingPriceValue" />
              </mat-form-field>
              <button mat-stroked-button (click)="updateAskingPrice()">Update</button>
            </div>
            @if (v.priceHistory.length) {
              <p class="hint">Price history: {{ v.priceHistory.length }} change(s)</p>
            }
            <button mat-flat-button color="primary" (click)="publishListing()">
              <mat-icon>storefront</mat-icon>
              Publish to listing platforms
            </button>
          </mat-card>

          <mat-card>
            <h3>Part-exchange appraisal</h3>
            @if (v.appraisal) {
              <p>Condition: {{ v.appraisal.condition }}</p>
              <p>Agreed value: {{ v.appraisal.agreedValue | currency: 'GBP' }}</p>
              @if (v.appraisal.damageNotes) {
                <p>Damage notes: {{ v.appraisal.damageNotes }}</p>
              }
            } @else {
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Condition</mat-label>
                <input matInput [(ngModel)]="appraisalForm.condition" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Damage notes</mat-label>
                <textarea matInput rows="2" [(ngModel)]="appraisalForm.damageNotes"></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Agreed value (£)</mat-label>
                <input matInput type="number" [(ngModel)]="appraisalForm.agreedValue" />
              </mat-form-field>
              <button mat-flat-button color="primary" [disabled]="!appraisalForm.agreedValue" (click)="createAppraisal()">
                Save appraisal
              </button>
            }
          </mat-card>
        </div>

        <div class="col">
          <mat-card>
            <h3>Deal sheet</h3>
            @if (v.dealSheet; as d) {
              <p>Selling price: {{ d.sellingPrice | currency: 'GBP' }}</p>
              <p>Gross profit: {{ d.grossProfit | currency: 'GBP' }}</p>
              @if (d.accessoryLines.length) {
                <p>Accessories:</p>
                <ul>
                  @for (a of d.accessoryLines; track a.description) {
                    <li>{{ a.description }} — {{ a.price | currency: 'GBP' }}</li>
                  }
                </ul>
                <p>Accessories total: {{ d.accessoriesTotal | currency: 'GBP' }}</p>
              }
              @if (d.pdfUrl) {
                <a [href]="storageUrl(d.pdfUrl)" target="_blank" rel="noopener">View deal sheet document</a>
              }
            } @else {
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Selling price (£)</mat-label>
                <input matInput type="number" [(ngModel)]="dealSheetForm.sellingPrice" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Part-exchange value (£)</mat-label>
                <input matInput type="number" [(ngModel)]="dealSheetForm.partExchangeValue" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Finance contribution (£)</mat-label>
                <input matInput type="number" [(ngModel)]="dealSheetForm.financeContribution" />
              </mat-form-field>

              <p class="accessories-label">Accessories</p>
              @for (line of accessoryLines(); track $index) {
                <div class="row">
                  <mat-form-field appearance="outline">
                    <mat-label>Description</mat-label>
                    <input matInput [(ngModel)]="line.description" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Price (£)</mat-label>
                    <input matInput type="number" [(ngModel)]="line.price" />
                  </mat-form-field>
                  <button mat-icon-button (click)="removeAccessoryLine($index)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              }
              <button mat-button (click)="addAccessoryLine()">
                <mat-icon>add</mat-icon>
                Add accessory
              </button>

              <button
                mat-flat-button
                color="primary"
                [disabled]="!dealSheetForm.sellingPrice"
                (click)="createDealSheet()"
              >
                Generate deal sheet
              </button>
            }
          </mat-card>
        </div>
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
      .columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      mat-card {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .full-width {
        width: 100%;
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .row mat-form-field {
        flex: 1;
      }
      .hint {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.5);
      }
      .accessories-label {
        font-weight: 600;
        margin: 8px 0 0;
      }
    `,
  ],
})
export class UsedCarDetailComponent implements OnInit {
  readonly vehicle = signal<UsedVehicleDetail | null>(null);
  readonly statuses = Object.values(UsedVehicleStatus);
  readonly accessoryLines = signal<AccessoryLine[]>([{ description: '', price: null }]);

  statusValue: UsedVehicleStatus = UsedVehicleStatus.IN_STOCK;
  askingPriceValue: number | null = null;

  appraisalForm = { condition: '', damageNotes: '', agreedValue: null as number | null };
  dealSheetForm = { sellingPrice: null as number | null, partExchangeValue: null as number | null, financeContribution: null as number | null };

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private vehicleId = '';

  ngOnInit(): void {
    this.vehicleId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.http.get<UsedVehicleDetail>(`${environment.apiUrl}/used-vehicles/${this.vehicleId}`).subscribe((data) => {
      this.vehicle.set(data);
      this.statusValue = data.status;
      this.askingPriceValue = data.askingPrice;
    });
  }

  storageUrl(path: string): string {
    return `${environment.apiUrl.replace(/\/api$/, '')}${path}`;
  }

  updateStatus(): void {
    this.http.patch(`${environment.apiUrl}/used-vehicles/${this.vehicleId}/status`, { status: this.statusValue }).subscribe(() => this.load());
  }

  updateAskingPrice(): void {
    if (this.askingPriceValue == null) return;
    this.http
      .patch(`${environment.apiUrl}/used-vehicles/${this.vehicleId}/asking-price`, { askingPrice: this.askingPriceValue })
      .subscribe(() => this.load());
  }

  publishListing(): void {
    this.http.post(`${environment.apiUrl}/listings/vehicles/${this.vehicleId}/publish`, {}).subscribe({
      next: () => this.snackBar.open('Published to all enabled listing platforms', 'Dismiss', { duration: 3000 }),
      error: () => this.snackBar.open('No listing platforms are enabled for this dealer yet', 'Dismiss', { duration: 3000 }),
    });
  }

  createAppraisal(): void {
    this.http.post(`${environment.apiUrl}/used-vehicles/${this.vehicleId}/appraisal`, this.appraisalForm).subscribe(() => this.load());
  }

  addAccessoryLine(): void {
    this.accessoryLines.update((lines) => [...lines, { description: '', price: null }]);
  }

  removeAccessoryLine(index: number): void {
    this.accessoryLines.update((lines) => lines.filter((_, i) => i !== index));
  }

  createDealSheet(): void {
    const accessories = this.accessoryLines()
      .filter((line) => line.description && line.price != null)
      .map((line) => ({ description: line.description, price: line.price }));

    this.http
      .post(`${environment.apiUrl}/used-vehicles/${this.vehicleId}/deal-sheet`, { ...this.dealSheetForm, accessories })
      .subscribe(() => this.load());
  }
}

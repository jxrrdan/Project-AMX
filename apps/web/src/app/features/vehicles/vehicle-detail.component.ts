import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SALE_MODEL_LABELS, SaleModel } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface NewCarSale {
  id: string;
  status: 'ACTIVE' | 'SIGNED' | 'INVALIDATED';
  saleModel: SaleModel;
  sellingPrice: number;
  agencyCommission: number | null;
  partExchangeValue: number | null;
  pdfUrl: string | null;
  invalidatedReason: string | null;
  createdAt: string;
  tradeIn: { usedVehicleId: string; agreedValue: number } | null;
}

interface VehicleDetail {
  id: string;
  vin: string;
  model: string;
  colour: string | null;
  customerName: string | null;
  status: string;
  sales: NewCarSale[];
}

@Component({
  selector: 'app-vehicle-detail',
  imports: [
    CurrencyPipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    @if (vehicle(); as v) {
      <div class="header">
        <div>
          <button mat-icon-button (click)="back()"><mat-icon>arrow_back</mat-icon></button>
          <span class="title">{{ v.model }}</span>
          <mat-chip>{{ v.status }}</mat-chip>
        </div>
      </div>
      <p class="subtitle">VIN {{ v.vin }} @if (v.colour) { · {{ v.colour }} } @if (v.customerName) { · {{ v.customerName }} }</p>

      <mat-card class="section">
        <h3>Sale</h3>
        @if (activeSale(); as s) {
          <mat-chip [class]="'status-' + s.status">{{ s.status }}</mat-chip>
          <p>{{ saleModelLabels[s.saleModel] }}</p>
          <p>Selling price: {{ s.sellingPrice | currency: 'GBP' }}</p>
          @if (s.saleModel === 'AGENCY') {
            <p>Agency commission: {{ s.agencyCommission | currency: 'GBP' }}</p>
          }
          @if (s.tradeIn) {
            <p>
              Trade-in taken in at {{ s.tradeIn.agreedValue | currency: 'GBP' }} —
              <a [routerLink]="['/used-cars', s.tradeIn.usedVehicleId]">view in stock</a>
            </p>
          }
          @if (s.pdfUrl) {
            <a [href]="storageUrl(s.pdfUrl)" target="_blank" rel="noopener">View sale document</a>
          }
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Reason (optional)</mat-label>
            <input matInput [(ngModel)]="invalidateReason" placeholder="e.g. Customer withdrew, finance declined" />
          </mat-form-field>
          <button mat-stroked-button color="warn" (click)="invalidateSale(s.id)">
            Invalidate — sale didn't go through
          </button>
        } @else {
          <mat-form-field appearance="outline">
            <mat-label>Sale model</mat-label>
            <mat-select [(ngModel)]="saleForm.saleModel">
              @for (m of saleModels; track m) {
                <mat-option [value]="m">{{ saleModelLabels[m] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Selling price (£)</mat-label>
            <input matInput type="number" [(ngModel)]="saleForm.sellingPrice" />
          </mat-form-field>
          @if (saleForm.saleModel === 'AGENCY') {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Agency commission (£)</mat-label>
              <input matInput type="number" [(ngModel)]="saleForm.agencyCommission" />
            </mat-form-field>
            <p class="hint">Agency sale — the manufacturer is the contracting seller; this is the fee earned for facilitating it.</p>
          }

          <mat-checkbox [(ngModel)]="hasTradeIn">Customer is trading in a vehicle</mat-checkbox>
          @if (hasTradeIn) {
            <div class="row">
              <mat-form-field appearance="outline">
                <mat-label>Reg</mat-label>
                <input matInput [(ngModel)]="tradeInForm.reg" placeholder="AB12 CDE" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Make</mat-label>
                <input matInput [(ngModel)]="tradeInForm.make" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Model</mat-label>
                <input matInput [(ngModel)]="tradeInForm.model" />
              </mat-form-field>
            </div>
            <div class="row">
              <mat-form-field appearance="outline">
                <mat-label>Mileage</mat-label>
                <input matInput type="number" [(ngModel)]="tradeInForm.mileage" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Condition</mat-label>
                <input matInput [(ngModel)]="tradeInForm.condition" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Agreed value (£)</mat-label>
                <input matInput type="number" [(ngModel)]="tradeInForm.agreedValue" />
              </mat-form-field>
            </div>
          }

          <button
            mat-flat-button
            color="primary"
            [disabled]="!saleForm.sellingPrice || (hasTradeIn && !isTradeInValid())"
            (click)="createSale()"
          >
            Create sale
          </button>
        }

        @if (pastSales().length) {
          <h4>Previous sales</h4>
          @for (s of pastSales(); track s.id) {
            <div class="line-item">
              <span>
                <mat-chip [class]="'status-' + s.status">{{ s.status }}</mat-chip>
                {{ s.sellingPrice | currency: 'GBP' }}
                @if (s.invalidatedReason) { — {{ s.invalidatedReason }} }
              </span>
              @if (s.pdfUrl) {
                <a [href]="storageUrl(s.pdfUrl)" target="_blank" rel="noopener">Document</a>
              }
            </div>
          }
        }
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
      .header > div {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .title {
        font-size: 18px;
        font-weight: 600;
      }
      .subtitle {
        color: rgba(0, 0, 0, 0.6);
        margin: 0 0 16px 40px;
      }
      .section {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 640px;
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
      .hint {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.5);
      }
      .line-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #eee;
        padding: 6px 0;
        font-size: 13px;
      }
      .status-ACTIVE {
        background: #e3f2fd;
      }
      .status-SIGNED {
        background: #e8f5e9;
      }
      .status-INVALIDATED {
        background: #fbe9e7;
        text-decoration: line-through;
      }
    `,
  ],
})
export class VehicleDetailComponent implements OnInit {
  readonly vehicle = signal<VehicleDetail | null>(null);
  readonly saleModels = Object.values(SaleModel);
  readonly saleModelLabels = SALE_MODEL_LABELS;
  readonly activeSale = () => this.vehicle()?.sales.find((s) => s.status === 'ACTIVE') ?? null;
  readonly pastSales = () => this.vehicle()?.sales.filter((s) => s.status !== 'ACTIVE') ?? [];

  saleForm = { saleModel: SaleModel.RETAIL, sellingPrice: null as number | null, agencyCommission: null as number | null };
  hasTradeIn = false;
  tradeInForm = {
    reg: '',
    make: '',
    model: '',
    mileage: null as number | null,
    condition: '',
    damageNotes: '',
    agreedValue: null as number | null,
  };
  invalidateReason = '';

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private vehicleId = '';

  ngOnInit(): void {
    this.vehicleId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.http.get<VehicleDetail>(`${environment.apiUrl}/vehicles/${this.vehicleId}`).subscribe((data) => this.vehicle.set(data));
  }

  isTradeInValid(): boolean {
    return !!(this.tradeInForm.reg && this.tradeInForm.make && this.tradeInForm.model && this.tradeInForm.agreedValue != null);
  }

  createSale(): void {
    const tradeIn = this.hasTradeIn && this.isTradeInValid() ? this.tradeInForm : undefined;
    this.http
      .post(`${environment.apiUrl}/vehicles/${this.vehicleId}/sales`, { ...this.saleForm, tradeIn })
      .subscribe({
        next: () => {
          this.hasTradeIn = false;
          this.load();
        },
        error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not create sale', 'Dismiss', { duration: 4000 }),
      });
  }

  invalidateSale(saleId: string): void {
    this.http
      .post(`${environment.apiUrl}/vehicles/${this.vehicleId}/sales/${saleId}/invalidate`, { reason: this.invalidateReason || undefined })
      .subscribe({
        next: () => {
          this.invalidateReason = '';
          this.snackBar.open('Sale invalidated — this vehicle can now get a new one', 'Dismiss', { duration: 3000 });
          this.load();
        },
        error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not invalidate sale', 'Dismiss', { duration: 4000 }),
      });
  }

  storageUrl(path: string): string {
    return `${environment.apiUrl.replace(/\/api$/, '')}${path}`;
  }

  back(): void {
    this.router.navigate(['/vehicles']);
  }
}

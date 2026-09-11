import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FiProductType } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface CommissionReport {
  totalCommission: number;
  dealCount: number;
  financePenetration: number;
  insuranceAttachment: number;
}

interface FinanceProduct {
  id: string;
  type: FiProductType;
  name: string;
  providerName: string;
  commissionRate: number | null;
  commissionFixed: number | null;
}

interface UsedVehicleOption {
  id: string;
  reg: string;
  make: string;
  model: string;
}

interface DealFinanceProduct {
  id: string;
  commissionAmount: number | null;
}

@Component({
  selector: 'app-fi-list',
  imports: [
    CurrencyPipe,
    FormsModule,
    MatCardModule,
    MatChipsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h1>Finance &amp; Insurance</h1>

    @if (report(); as r) {
      <div class="grid">
        <mat-card>
          <div class="label">Total commission</div>
          <div class="value">{{ r.totalCommission | currency: 'GBP' }}</div>
        </mat-card>
        <mat-card>
          <div class="label">Deals with F&amp;I</div>
          <div class="value">{{ r.dealCount }}</div>
        </mat-card>
        <mat-card>
          <div class="label">Finance penetration</div>
          <div class="value">{{ r.financePenetration }}</div>
        </mat-card>
        <mat-card>
          <div class="label">Insurance attachment</div>
          <div class="value">{{ r.insuranceAttachment }}</div>
        </mat-card>
      </div>
    }

    <div class="columns">
      <mat-card>
        <h3>Product catalogue</h3>
        @for (p of products(); track p.id) {
          <div class="product-row">
            <span>{{ p.name }}</span>
            <mat-chip>{{ p.type }}</mat-chip>
            <span class="provider">{{ p.providerName }}</span>
          </div>
        }

        <h3>Add a product</h3>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Type</mat-label>
          <mat-select [(ngModel)]="productForm.type">
            <mat-option value="FINANCE">Finance</mat-option>
            <mat-option value="INSURANCE">Insurance</mat-option>
          </mat-select>
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Name</mat-label>
            <input matInput [(ngModel)]="productForm.name" placeholder="GAP Insurance" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Provider</mat-label>
            <input matInput [(ngModel)]="productForm.providerName" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Commission rate (%)</mat-label>
          <input matInput type="number" [(ngModel)]="productForm.commissionRate" />
        </mat-form-field>
        <button mat-flat-button color="primary" [disabled]="!productForm.name || !productForm.providerName" (click)="createProduct()">
          Add product
        </button>
      </mat-card>

      <mat-card>
        <h3>Add a product to a deal</h3>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Used vehicle</mat-label>
          <mat-select [(ngModel)]="dealForm.usedVehicleId">
            @for (v of usedVehicles(); track v.id) {
              <mat-option [value]="v.id">{{ v.reg }} — {{ v.make }} {{ v.model }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Product</mat-label>
          <mat-select [(ngModel)]="dealForm.productId">
            @for (p of products(); track p.id) {
              <mat-option [value]="p.id">{{ p.name }} ({{ p.providerName }})</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Total premium / amount (£)</mat-label>
            <input matInput type="number" [(ngModel)]="dealForm.totalPremium" />
          </mat-form-field>
        </div>
        <button mat-flat-button color="primary" [disabled]="!dealForm.usedVehicleId || !dealForm.productId" (click)="addToDeal()">
          Add to deal
        </button>

        @if (lastDealProduct(); as d) {
          <div class="disclosure">
            <p>Commission: {{ d.commissionAmount | currency: 'GBP' }}</p>
            <h4>FCA disclosure (§13.3)</h4>
            <mat-checkbox [(ngModel)]="disclosureForm.commissionDisclosed">
              Customer informed of dealer's commission
            </mat-checkbox>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Customer signature reference</mat-label>
              <input matInput [(ngModel)]="disclosureForm.customerSignatureUrl" placeholder="signature-001.png" />
            </mat-form-field>
            <mat-checkbox [(ngModel)]="disclosureForm.vulnerableCustomerFlag">Vulnerable customer — enhanced care taken</mat-checkbox>
            <button
              mat-flat-button
              color="primary"
              [disabled]="!disclosureForm.commissionDisclosed || !disclosureForm.customerSignatureUrl"
              (click)="recordDisclosure(d.id)"
            >
              Record disclosure
            </button>
          </div>
        }
      </mat-card>
    </div>
  `,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 16px;
      }
      .columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      mat-card {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .label {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
      }
      .value {
        font-size: 22px;
        font-weight: 600;
      }
      .product-row {
        display: flex;
        gap: 8px;
        align-items: center;
        border-bottom: 1px solid #eee;
        padding: 6px 0;
        font-size: 13px;
      }
      .provider {
        color: rgba(0, 0, 0, 0.5);
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
      .disclosure {
        border-top: 1px solid #eee;
        padding-top: 12px;
        margin-top: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
    `,
  ],
})
export class FiListComponent implements OnInit {
  readonly report = signal<CommissionReport | null>(null);
  readonly products = signal<FinanceProduct[]>([]);
  readonly usedVehicles = signal<UsedVehicleOption[]>([]);
  readonly lastDealProduct = signal<DealFinanceProduct | null>(null);

  productForm = { type: FiProductType.INSURANCE as FiProductType, name: '', providerName: '', commissionRate: null as number | null };
  dealForm = { usedVehicleId: '', productId: '', totalPremium: null as number | null };
  disclosureForm = { commissionDisclosed: false, customerSignatureUrl: '', vulnerableCustomerFlag: false };

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
    this.http.get<UsedVehicleOption[]>(`${environment.apiUrl}/used-vehicles`).subscribe((data) => this.usedVehicles.set(data));
  }

  load(): void {
    this.http.get<CommissionReport>(`${environment.apiUrl}/fi/reports/commission`).subscribe((data) => this.report.set(data));
    this.http.get<FinanceProduct[]>(`${environment.apiUrl}/fi/products`).subscribe((data) => this.products.set(data));
  }

  createProduct(): void {
    this.http.post(`${environment.apiUrl}/fi/products`, this.productForm).subscribe(() => {
      this.productForm = { type: FiProductType.INSURANCE, name: '', providerName: '', commissionRate: null };
      this.load();
    });
  }

  addToDeal(): void {
    this.http.post<DealFinanceProduct>(`${environment.apiUrl}/fi/deal-products`, this.dealForm).subscribe((data) => {
      this.lastDealProduct.set(data);
      this.load();
    });
  }

  recordDisclosure(dealProductId: string): void {
    this.http.post(`${environment.apiUrl}/fi/deal-products/${dealProductId}/disclosure`, this.disclosureForm).subscribe(() => {
      this.lastDealProduct.set(null);
      this.disclosureForm = { commissionDisclosed: false, customerSignatureUrl: '', vulnerableCustomerFlag: false };
    });
  }
}

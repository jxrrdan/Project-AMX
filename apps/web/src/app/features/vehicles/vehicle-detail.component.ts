import { CurrencyPipe, DatePipe } from '@angular/common';
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
import { SALE_MODEL_LABELS, SaleModel, VEHICLE_CONTACT_ROLE_LABELS, VehicleContactRole } from '@project-amx/shared';
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

interface ContactOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface VehicleContactLink {
  id: string;
  role: VehicleContactRole;
  startedAt: string;
  endedAt: string | null;
  contact: ContactOption;
}

@Component({
  selector: 'app-vehicle-detail',
  imports: [
    CurrencyPipe,
    DatePipe,
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
        <h3>People — owner, keeper &amp; drivers</h3>
        <p class="hint">
          A vehicle's registered keeper and legal owner (e.g. a finance company on a PCP/lease deal) can be
          different people, and can change over the vehicle's life — this keeps a record of who held each role.
        </p>
        @for (role of vehicleContactRoles; track role) {
          <div class="role-row">
            <span class="role-label">{{ vehicleContactRoleLabels[role] }}</span>
            @for (link of currentLinksByRole(role); track link.id) {
              <mat-chip>{{ link.contact.firstName }} {{ link.contact.lastName }}</mat-chip>
              <button mat-icon-button (click)="endContactLink(link.id)" title="End this link">
                <mat-icon>close</mat-icon>
              </button>
            } @empty {
              <span class="hint">none set</span>
            }
          </div>
        }

        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Contact</mat-label>
            <mat-select [(ngModel)]="linkContactId">
              @for (c of contactOptions(); track c.id) {
                <mat-option [value]="c.id">{{ c.firstName }} {{ c.lastName }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Role</mat-label>
            <mat-select [(ngModel)]="linkRole">
              @for (role of vehicleContactRoles; track role) {
                <mat-option [value]="role">{{ vehicleContactRoleLabels[role] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button mat-flat-button color="primary" [disabled]="!linkContactId" (click)="linkContact()">Add</button>
        </div>

        @if (pastLinks().length) {
          <h4>History</h4>
          @for (link of pastLinks(); track link.id) {
            <div class="line-item">
              <span>{{ vehicleContactRoleLabels[link.role] }} — {{ link.contact.firstName }} {{ link.contact.lastName }}</span>
              <span class="hint">ended {{ link.endedAt | date: 'd MMM y' }}</span>
            </div>
          }
        }
      </mat-card>

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
      .role-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 4px 0;
      }
      .role-label {
        font-weight: 600;
        font-size: 13px;
        min-width: 120px;
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

  readonly contactLinks = signal<VehicleContactLink[]>([]);
  readonly contactOptions = signal<ContactOption[]>([]);
  readonly vehicleContactRoles = Object.values(VehicleContactRole);
  readonly vehicleContactRoleLabels = VEHICLE_CONTACT_ROLE_LABELS;
  readonly currentLinksByRole = (role: VehicleContactRole) =>
    this.contactLinks().filter((l) => l.role === role && !l.endedAt);
  readonly pastLinks = () => this.contactLinks().filter((l) => !!l.endedAt);

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
  linkContactId = '';
  linkRole: VehicleContactRole = VehicleContactRole.KEEPER;

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private vehicleId = '';

  ngOnInit(): void {
    this.vehicleId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
    this.loadContactLinks();
    this.http.get<ContactOption[]>(`${environment.apiUrl}/contacts`).subscribe((data) => this.contactOptions.set(data));
  }

  load(): void {
    this.http.get<VehicleDetail>(`${environment.apiUrl}/vehicles/${this.vehicleId}`).subscribe((data) => this.vehicle.set(data));
  }

  loadContactLinks(): void {
    this.http
      .get<VehicleContactLink[]>(`${environment.apiUrl}/vehicles/${this.vehicleId}/contacts`)
      .subscribe((data) => this.contactLinks.set(data));
  }

  linkContact(): void {
    if (!this.linkContactId) return;
    this.http
      .post(`${environment.apiUrl}/vehicles/${this.vehicleId}/contacts`, { contactId: this.linkContactId, role: this.linkRole })
      .subscribe({
        next: () => {
          this.linkContactId = '';
          this.loadContactLinks();
        },
        error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not link contact', 'Dismiss', { duration: 4000 }),
      });
  }

  endContactLink(linkId: string): void {
    this.http.post(`${environment.apiUrl}/vehicles/${this.vehicleId}/contacts/${linkId}/end`, {}).subscribe({
      next: () => this.loadContactLinks(),
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not end this link', 'Dismiss', { duration: 4000 }),
    });
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

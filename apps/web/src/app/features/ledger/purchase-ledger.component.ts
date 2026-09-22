import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { SUPPLIER_INVOICE_STATUS_LABELS, SupplierInvoiceStatus } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface Supplier {
  id: string;
  name: string;
  accountNumber: string | null;
  vatNumber: string | null;
  email: string | null;
  phone: string | null;
  isManufacturer: boolean;
  active: boolean;
}

interface PoLine {
  id: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  part: { partNumber: string; description: string };
}

interface PurchaseOrder {
  id: string;
  supplier: Supplier;
  status: string;
  lines: PoLine[];
}

interface Grn {
  id: string;
  grnNumber: string;
  receivedAt: string;
  supplier: Supplier;
  purchaseOrder: { id: string };
}

interface SupplierInvoice {
  id: string;
  supplier: Supplier;
  purchaseOrderId: string | null;
  goodsReceiptNoteId: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  status: SupplierInvoiceStatus;
  matchDiscrepancy: string | null;
}

interface ExtractedInvoice {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  netAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  supplierName: string | null;
}

@Component({
  selector: 'app-purchase-ledger',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatTabsModule,
  ],
  template: `
    <h1>Purchase Ledger</h1>

    <mat-tab-group>
      <mat-tab label="Suppliers">
        <mat-card>
          <h3>Add a supplier</h3>
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Name</mat-label>
              <input matInput [(ngModel)]="newSupplier.name" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Account number</mat-label>
              <input matInput [(ngModel)]="newSupplier.accountNumber" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>VAT number</mat-label>
              <input matInput [(ngModel)]="newSupplier.vatNumber" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput [(ngModel)]="newSupplier.email" />
            </mat-form-field>
            <mat-checkbox [(ngModel)]="newSupplier.isManufacturer">Manufacturer / OEM</mat-checkbox>
            <button mat-flat-button color="primary" [disabled]="!newSupplier.name" (click)="createSupplier()">Add</button>
          </div>
        </mat-card>

        <table mat-table [dataSource]="suppliers()" class="mat-elevation-z1">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let s">
              {{ s.name }}
              @if (s.isManufacturer) {
                <mat-chip class="oem-chip">OEM</mat-chip>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="accountNumber">
            <th mat-header-cell *matHeaderCellDef>Account no.</th>
            <td mat-cell *matCellDef="let s">{{ s.accountNumber || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="vatNumber">
            <th mat-header-cell *matHeaderCellDef>VAT number</th>
            <td mat-cell *matCellDef="let s">{{ s.vatNumber || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="active">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let s"><mat-chip>{{ s.active ? 'Active' : 'Inactive' }}</mat-chip></td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="supplierColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: supplierColumns"></tr>
        </table>
      </mat-tab>

      <mat-tab label="Goods receipt notes">
        <mat-card>
          <h3>Record a delivery against a purchase order</h3>
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Purchase order</mat-label>
              <mat-select [(ngModel)]="grnPurchaseOrderId" (selectionChange)="onSelectPoForGrn()">
                @for (po of openPurchaseOrders(); track po.id) {
                  <mat-option [value]="po.id">{{ po.supplier.name }} — {{ po.status }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
          @if (grnLines().length) {
            @for (line of grnLines(); track line.purchaseOrderLineId) {
              <div class="row">
                <span class="line-desc">{{ line.description }} ({{ line.quantityOrdered - line.quantityReceived }} outstanding)</span>
                <mat-form-field appearance="outline">
                  <mat-label>Quantity received</mat-label>
                  <input matInput type="number" [(ngModel)]="line.quantityReceived" />
                </mat-form-field>
              </div>
            }
            <button mat-flat-button color="primary" (click)="createGrn()">Record goods receipt note</button>
          }
        </mat-card>

        <table mat-table [dataSource]="grns()" class="mat-elevation-z1">
          <ng-container matColumnDef="grnNumber">
            <th mat-header-cell *matHeaderCellDef>GRN number</th>
            <td mat-cell *matCellDef="let g">{{ g.grnNumber }}</td>
          </ng-container>
          <ng-container matColumnDef="supplier">
            <th mat-header-cell *matHeaderCellDef>Supplier</th>
            <td mat-cell *matCellDef="let g">{{ g.supplier.name }}</td>
          </ng-container>
          <ng-container matColumnDef="receivedAt">
            <th mat-header-cell *matHeaderCellDef>Received</th>
            <td mat-cell *matCellDef="let g">{{ g.receivedAt | date: 'dd/MM/yyyy' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="grnColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: grnColumns"></tr>
        </table>
      </mat-tab>

      <mat-tab label="Supplier invoices">
        <mat-card>
          <h3>AI invoice extraction</h3>
          <p class="hint">Paste the text of a scanned or emailed supplier invoice to prefill the form below.</p>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Invoice text</mat-label>
            <textarea matInput rows="4" [(ngModel)]="extractText"></textarea>
          </mat-form-field>
          <button mat-stroked-button [disabled]="!extractText" (click)="extractInvoice()">Extract fields</button>
        </mat-card>

        <mat-card>
          <h3>New supplier invoice</h3>
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Supplier</mat-label>
              <mat-select [(ngModel)]="newInvoice.supplierId">
                @for (s of suppliers(); track s.id) {
                  <mat-option [value]="s.id">{{ s.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Purchase order (optional)</mat-label>
              <mat-select [(ngModel)]="newInvoice.purchaseOrderId">
                <mat-option [value]="null">None</mat-option>
                @for (po of purchaseOrders(); track po.id) {
                  <mat-option [value]="po.id">{{ po.supplier.name }} — {{ po.status }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Invoice number</mat-label>
              <input matInput [(ngModel)]="newInvoice.invoiceNumber" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Invoice date</mat-label>
              <input matInput type="date" [(ngModel)]="newInvoice.invoiceDate" />
            </mat-form-field>
          </div>
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Net amount</mat-label>
              <input matInput type="number" [(ngModel)]="newInvoice.netAmount" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>VAT amount</mat-label>
              <input matInput type="number" [(ngModel)]="newInvoice.vatAmount" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Total amount</mat-label>
              <input matInput type="number" [(ngModel)]="newInvoice.totalAmount" />
            </mat-form-field>
            <button
              mat-flat-button
              color="primary"
              [disabled]="!newInvoice.supplierId || !newInvoice.invoiceNumber || !newInvoice.invoiceDate"
              (click)="createInvoice()"
            >
              Create
            </button>
          </div>
        </mat-card>

        <table mat-table [dataSource]="invoices()" class="mat-elevation-z1">
          <ng-container matColumnDef="supplier">
            <th mat-header-cell *matHeaderCellDef>Supplier</th>
            <td mat-cell *matCellDef="let i">{{ i.supplier.name }}</td>
          </ng-container>
          <ng-container matColumnDef="invoiceNumber">
            <th mat-header-cell *matHeaderCellDef>Invoice #</th>
            <td mat-cell *matCellDef="let i">{{ i.invoiceNumber }}</td>
          </ng-container>
          <ng-container matColumnDef="total">
            <th mat-header-cell *matHeaderCellDef>Total</th>
            <td mat-cell *matCellDef="let i">{{ i.totalAmount | currency: 'GBP' }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let i">
              <mat-chip [class.discrepancy]="i.status === 'DISCREPANCY'">{{ statusLabel(i.status) }}</mat-chip>
              @if (i.matchDiscrepancy) {
                <div class="discrepancy-note">{{ i.matchDiscrepancy }}</div>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let i">
              @if (i.purchaseOrderId && (i.status === 'DRAFT' || i.status === 'DISCREPANCY')) {
                <button mat-button (click)="matchInvoice(i.id)">Match</button>
              }
              @if (i.status === 'DRAFT' || i.status === 'MATCHED') {
                <button mat-button color="primary" (click)="approveInvoice(i.id)">Approve</button>
              }
              @if (i.status === 'APPROVED') {
                <button mat-button color="accent" (click)="payInvoice(i.id)">Mark paid</button>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="invoiceColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: invoiceColumns"></tr>
        </table>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: [
    `
      mat-card {
        padding: 16px;
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      table {
        width: 100%;
        margin-bottom: 16px;
      }
      .full-width {
        width: 100%;
      }
      .hint {
        font-size: 12px;
        color: #666;
        margin: 0;
      }
      .oem-chip {
        margin-left: 8px;
        font-size: 11px;
        min-height: 20px;
        padding: 0 8px;
      }
      .line-desc {
        min-width: 240px;
      }
      .discrepancy {
        background: #fdecea;
      }
      .discrepancy-note {
        font-size: 11px;
        color: #c62828;
        max-width: 320px;
      }
    `,
  ],
})
export class PurchaseLedgerComponent implements OnInit {
  readonly suppliers = signal<Supplier[]>([]);
  readonly purchaseOrders = signal<PurchaseOrder[]>([]);
  readonly grns = signal<Grn[]>([]);
  readonly invoices = signal<SupplierInvoice[]>([]);
  readonly grnLines = signal<{ purchaseOrderLineId: string; description: string; quantityOrdered: number; quantityReceived: number }[]>(
    [],
  );

  readonly supplierColumns = ['name', 'accountNumber', 'vatNumber', 'active'];
  readonly grnColumns = ['grnNumber', 'supplier', 'receivedAt'];
  readonly invoiceColumns = ['supplier', 'invoiceNumber', 'total', 'status', 'actions'];
  readonly statusLabels = SUPPLIER_INVOICE_STATUS_LABELS;

  newSupplier: { name: string; accountNumber: string; vatNumber: string; email: string; isManufacturer: boolean } = {
    name: '',
    accountNumber: '',
    vatNumber: '',
    email: '',
    isManufacturer: false,
  };

  grnPurchaseOrderId = '';
  extractText = '';

  newInvoice: {
    supplierId: string;
    purchaseOrderId: string | null;
    invoiceNumber: string;
    invoiceDate: string;
    netAmount: number | null;
    vatAmount: number | null;
    totalAmount: number | null;
  } = {
    supplierId: '',
    purchaseOrderId: null,
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    netAmount: null,
    vatAmount: null,
    totalAmount: null,
  };

  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.load();
  }

  statusLabel(status: SupplierInvoiceStatus): string {
    return this.statusLabels[status];
  }

  openPurchaseOrders() {
    return this.purchaseOrders().filter((po) => po.lines.some((l) => l.quantityReceived < l.quantityOrdered));
  }

  load(): void {
    this.http.get<Supplier[]>(`${environment.apiUrl}/suppliers`).subscribe((data) => this.suppliers.set(data));
    this.http.get<PurchaseOrder[]>(`${environment.apiUrl}/purchase-orders`).subscribe((data) => this.purchaseOrders.set(data));
    this.http.get<Grn[]>(`${environment.apiUrl}/goods-receipt-notes`).subscribe((data) => this.grns.set(data));
    this.http.get<SupplierInvoice[]>(`${environment.apiUrl}/supplier-invoices`).subscribe((data) => this.invoices.set(data));
  }

  createSupplier(): void {
    this.http.post(`${environment.apiUrl}/suppliers`, this.newSupplier).subscribe(() => {
      this.newSupplier = { name: '', accountNumber: '', vatNumber: '', email: '', isManufacturer: false };
      this.load();
    });
  }

  onSelectPoForGrn(): void {
    const po = this.purchaseOrders().find((p) => p.id === this.grnPurchaseOrderId);
    this.grnLines.set(
      (po?.lines ?? [])
        .filter((l) => l.quantityReceived < l.quantityOrdered)
        .map((l) => ({
          purchaseOrderLineId: l.id,
          description: l.part.description,
          quantityOrdered: l.quantityOrdered,
          quantityReceived: l.quantityOrdered - l.quantityReceived,
        })),
    );
  }

  createGrn(): void {
    this.http
      .post(`${environment.apiUrl}/goods-receipt-notes`, {
        purchaseOrderId: this.grnPurchaseOrderId,
        lines: this.grnLines().map((l) => ({ purchaseOrderLineId: l.purchaseOrderLineId, quantityReceived: l.quantityReceived })),
      })
      .subscribe(() => {
        this.grnPurchaseOrderId = '';
        this.grnLines.set([]);
        this.load();
        this.snackBar.open('Goods receipt note recorded', 'Dismiss', { duration: 3000 });
      });
  }

  extractInvoice(): void {
    this.http.post<ExtractedInvoice>(`${environment.apiUrl}/supplier-invoices/extract`, { text: this.extractText }).subscribe((data) => {
      this.newInvoice = {
        ...this.newInvoice,
        invoiceNumber: data.invoiceNumber ?? this.newInvoice.invoiceNumber,
        netAmount: data.netAmount ?? this.newInvoice.netAmount,
        vatAmount: data.vatAmount ?? this.newInvoice.vatAmount,
        totalAmount: data.totalAmount ?? this.newInvoice.totalAmount,
      };
      this.snackBar.open('Extracted what we could find — please check before saving', 'Dismiss', { duration: 4000 });
    });
  }

  createInvoice(): void {
    this.http.post(`${environment.apiUrl}/supplier-invoices`, this.newInvoice).subscribe({
      next: () => {
        this.newInvoice = {
          supplierId: '',
          purchaseOrderId: null,
          invoiceNumber: '',
          invoiceDate: new Date().toISOString().slice(0, 10),
          netAmount: null,
          vatAmount: null,
          totalAmount: null,
        };
        this.load();
      },
      error: (err) => this.snackBar.open(err.error?.message ?? 'Failed to create invoice', 'Dismiss', { duration: 5000 }),
    });
  }

  matchInvoice(id: string): void {
    this.http.post(`${environment.apiUrl}/supplier-invoices/${id}/match`, {}).subscribe(() => this.load());
  }

  approveInvoice(id: string): void {
    this.http.post(`${environment.apiUrl}/supplier-invoices/${id}/approve`, {}).subscribe({
      next: () => this.load(),
      error: (err) => this.snackBar.open(err.error?.message ?? 'Failed to approve invoice', 'Dismiss', { duration: 5000 }),
    });
  }

  payInvoice(id: string): void {
    this.http.post(`${environment.apiUrl}/supplier-invoices/${id}/pay`, {}).subscribe(() => this.load());
  }
}

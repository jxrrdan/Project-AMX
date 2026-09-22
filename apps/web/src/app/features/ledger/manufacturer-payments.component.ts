import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MANUFACTURER_PAYMENT_BATCH_STATUS_LABELS, ManufacturerPaymentBatchStatus } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface Supplier {
  id: string;
  name: string;
  isManufacturer: boolean;
}

interface WarrantyClaim {
  id: string;
  customerName: string;
  faultDescription: string;
  expectedPayment: number | null;
  status: string;
}

interface BatchLine {
  id: string;
  warrantyClaimId: string | null;
  description: string;
  amount: number;
  discrepancy: number | null;
  warrantyClaim: WarrantyClaim | null;
}

interface Batch {
  id: string;
  supplier: Supplier;
  batchReference: string;
  isSelfBill: boolean;
  totalAmount: number;
  status: ManufacturerPaymentBatchStatus;
  receivedAt: string;
  lines: BatchLine[];
}

interface DraftLine {
  warrantyClaimId: string | null;
  description: string;
  amount: number | null;
}

@Component({
  selector: 'app-manufacturer-payments',
  imports: [
    CurrencyPipe,
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
    <h1>Manufacturer & Warranty Payment Batches</h1>
    <p class="hint">
      A manufacturer's remittance is a self-billing document — it stands in for a supplier invoice the dealer would
      otherwise have to raise. Reconcile a batch against the expected payment on each warranty claim, then post it
      once to settle every claim in one journal entry.
    </p>

    <mat-card>
      <h3>New batch</h3>
      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>Manufacturer / supplier</mat-label>
          <mat-select [(ngModel)]="draft.supplierId">
            @for (s of suppliers(); track s.id) {
              <mat-option [value]="s.id">{{ s.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Batch reference</mat-label>
          <input matInput [(ngModel)]="draft.batchReference" placeholder="e.g. AWP-2026-09" />
        </mat-form-field>
      </div>

      @for (line of draft.lines; track $index) {
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Warranty claim (optional)</mat-label>
            <mat-select [(ngModel)]="line.warrantyClaimId" (selectionChange)="onSelectClaim(line, $event.value)">
              <mat-option [value]="null">None</mat-option>
              @for (c of warrantyClaims(); track c.id) {
                <mat-option [value]="c.id">{{ c.customerName }} — {{ c.faultDescription }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Description</mat-label>
            <input matInput [(ngModel)]="line.description" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Amount</mat-label>
            <input matInput type="number" [(ngModel)]="line.amount" />
          </mat-form-field>
          <button mat-icon-button (click)="removeLine($index)"><mat-icon>delete</mat-icon></button>
        </div>
      }
      <div class="row">
        <button mat-stroked-button (click)="addLine()">Add line</button>
        <span class="spacer"></span>
        <span>Batch total: {{ draftTotal() | currency: 'GBP' }}</span>
        <button mat-flat-button color="primary" [disabled]="!canCreate()" (click)="createBatch()">Create batch</button>
      </div>
    </mat-card>

    @for (batch of batches(); track batch.id) {
      <mat-card class="batch-card">
        <div class="batch-header">
          <span class="ref">{{ batch.batchReference }}</span>
          <span>{{ batch.supplier.name }}</span>
          <mat-chip [class.discrepancy]="batch.status === 'DISCREPANCY'">{{ statusLabel(batch.status) }}</mat-chip>
          <span class="spacer"></span>
          <span>{{ batch.totalAmount | currency: 'GBP' }}</span>
          @if (batch.status === 'RECEIVED' || batch.status === 'DISCREPANCY') {
            <button mat-button (click)="reconcile(batch.id)">Reconcile</button>
          }
          @if (batch.status === 'RECONCILED' || batch.status === 'DISCREPANCY') {
            <button mat-flat-button color="primary" (click)="post(batch.id)">Post to ledger</button>
          }
        </div>
        @for (line of batch.lines; track line.id) {
          <div class="line-item">
            <span>{{ line.description }}</span>
            <span>{{ line.amount | currency: 'GBP' }}</span>
            @if (line.discrepancy !== null) {
              <span class="discrepancy-note">discrepancy: {{ line.discrepancy | currency: 'GBP' }}</span>
            }
          </div>
        }
      </mat-card>
    }
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
      .hint {
        font-size: 13px;
        color: #666;
        max-width: 800px;
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .spacer {
        flex: 1;
      }
      .batch-header {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .ref {
        font-weight: 600;
      }
      .line-item {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid #eee;
        padding: 6px 0;
        font-size: 13px;
      }
      .discrepancy {
        background: #fdecea;
      }
      .discrepancy-note {
        color: #c62828;
      }
    `,
  ],
})
export class ManufacturerPaymentsComponent implements OnInit {
  readonly suppliers = signal<Supplier[]>([]);
  readonly warrantyClaims = signal<WarrantyClaim[]>([]);
  readonly batches = signal<Batch[]>([]);
  readonly statusLabels = MANUFACTURER_PAYMENT_BATCH_STATUS_LABELS;

  draft: { supplierId: string; batchReference: string; lines: DraftLine[] } = {
    supplierId: '',
    batchReference: '',
    lines: [{ warrantyClaimId: null, description: '', amount: null }],
  };

  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.http.get<Supplier[]>(`${environment.apiUrl}/suppliers`).subscribe((data) => this.suppliers.set(data));
    this.http.get<WarrantyClaim[]>(`${environment.apiUrl}/warranty-claims`).subscribe((data) => this.warrantyClaims.set(data));
    this.http.get<Batch[]>(`${environment.apiUrl}/manufacturer-payment-batches`).subscribe((data) => this.batches.set(data));
  }

  statusLabel(status: ManufacturerPaymentBatchStatus): string {
    return this.statusLabels[status];
  }

  onSelectClaim(line: DraftLine, claimId: string | null): void {
    const claim = this.warrantyClaims().find((c) => c.id === claimId);
    if (claim) {
      line.description = claim.faultDescription;
      line.amount = claim.expectedPayment;
    }
  }

  addLine(): void {
    this.draft.lines.push({ warrantyClaimId: null, description: '', amount: null });
  }

  removeLine(index: number): void {
    this.draft.lines.splice(index, 1);
  }

  draftTotal(): number {
    return this.draft.lines.reduce((sum, l) => sum + (l.amount ?? 0), 0);
  }

  canCreate(): boolean {
    return !!this.draft.supplierId && !!this.draft.batchReference && this.draft.lines.every((l) => l.description && l.amount);
  }

  createBatch(): void {
    this.http.post(`${environment.apiUrl}/manufacturer-payment-batches`, this.draft).subscribe({
      next: () => {
        this.draft = { supplierId: '', batchReference: '', lines: [{ warrantyClaimId: null, description: '', amount: null }] };
        this.load();
      },
      error: (err) => this.snackBar.open(err.error?.message ?? 'Failed to create batch', 'Dismiss', { duration: 5000 }),
    });
  }

  reconcile(id: string): void {
    this.http.post(`${environment.apiUrl}/manufacturer-payment-batches/${id}/reconcile`, {}).subscribe(() => this.load());
  }

  post(id: string): void {
    this.http.post(`${environment.apiUrl}/manufacturer-payment-batches/${id}/post`, {}).subscribe({
      next: () => {
        this.load();
        this.snackBar.open('Batch posted — linked warranty claims marked as paid', 'Dismiss', { duration: 4000 });
      },
      error: (err) => this.snackBar.open(err.error?.message ?? 'Failed to post batch', 'Dismiss', { duration: 5000 }),
    });
  }
}

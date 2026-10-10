import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { CREDIT_NOTE_STATUS_LABELS, CreditNoteStatus } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface CreditNoteRow {
  id: string;
  number: string | null;
  customerName: string;
  reason: string;
  status: CreditNoteStatus;
  total: string;
}

interface DraftLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

@Component({
  selector: 'app-credit-notes-list',
  imports: [
    CurrencyPipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
  ],
  template: `
    <div class="header">
      <h1>Credit Notes</h1>
      <button mat-flat-button color="primary" (click)="showForm.set(!showForm())">
        <mat-icon>add</mat-icon> New credit note
      </button>
    </div>

    @if (showForm()) {
      <mat-card class="form-card">
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Customer name</mat-label>
            <input matInput [(ngModel)]="form.customerName" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Related invoice (optional)</mat-label>
            <input matInput [(ngModel)]="form.relatedInvoiceRef" placeholder="e.g. INV-2026-00042" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Reason</mat-label>
          <input matInput [(ngModel)]="form.reason" placeholder="e.g. Goodwill gesture — delayed repair" />
        </mat-form-field>

        <h4>Lines</h4>
        @for (line of form.lines; track $index) {
          <div class="line-row">
            <mat-form-field appearance="outline" class="desc">
              <mat-label>Description</mat-label>
              <input matInput [(ngModel)]="line.description" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="sm">
              <mat-label>Qty</mat-label>
              <input matInput type="number" [(ngModel)]="line.quantity" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="sm">
              <mat-label>Unit £</mat-label>
              <input matInput type="number" [(ngModel)]="line.unitPrice" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="sm">
              <mat-label>Tax %</mat-label>
              <input matInput type="number" [ngModel]="line.taxRate * 100" (ngModelChange)="line.taxRate = $event / 100" />
            </mat-form-field>
            <button mat-icon-button color="warn" (click)="removeLine($index)" [disabled]="form.lines.length === 1">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        }
        <button mat-stroked-button (click)="addLine()"><mat-icon>add</mat-icon> Add line</button>

        <p class="totals">Total (incl. tax): {{ draftTotal() | currency: 'GBP' }}</p>
        <button mat-flat-button color="primary" [disabled]="!isValid()" (click)="create()">Create draft</button>
      </mat-card>
    }

    <table mat-table [dataSource]="notes()" class="mat-elevation-z1">
      <ng-container matColumnDef="number">
        <th mat-header-cell *matHeaderCellDef>Number</th>
        <td mat-cell *matCellDef="let n"><a [routerLink]="['/credit-notes', n.id]">{{ n.number || 'Draft' }}</a></td>
      </ng-container>
      <ng-container matColumnDef="customer">
        <th mat-header-cell *matHeaderCellDef>Customer</th>
        <td mat-cell *matCellDef="let n">{{ n.customerName }}</td>
      </ng-container>
      <ng-container matColumnDef="reason">
        <th mat-header-cell *matHeaderCellDef>Reason</th>
        <td mat-cell *matCellDef="let n">{{ n.reason }}</td>
      </ng-container>
      <ng-container matColumnDef="total">
        <th mat-header-cell *matHeaderCellDef>Total</th>
        <td mat-cell *matCellDef="let n">{{ +n.total | currency: 'GBP' }}</td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Status</th>
        <td mat-cell *matCellDef="let n"><mat-chip [class]="'status-' + n.status">{{ statusLabel(n.status) }}</mat-chip></td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>

    @if (!notes().length) { <p class="empty">No credit notes yet.</p> }
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .form-card {
        max-width: 760px;
        margin-bottom: 16px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
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
      .line-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .line-row .desc {
        flex: 1;
      }
      .line-row .sm {
        width: 90px;
      }
      .totals {
        font-weight: 600;
        text-align: right;
      }
      table {
        width: 100%;
      }
      a {
        color: var(--bmw-blue-text);
        text-decoration: none;
      }
      .status-DRAFT {
        background: var(--amx-surface-sunken);
      }
      .status-ISSUED {
        background: var(--amx-info-bg);
      }
      .status-APPLIED {
        background: var(--amx-success-bg);
      }
      .status-CANCELLED {
        background: var(--amx-danger-bg);
        text-decoration: line-through;
      }
      .empty {
        color: var(--amx-text-tertiary);
        margin-top: 16px;
      }
    `,
  ],
})
export class CreditNotesListComponent implements OnInit {
  readonly notes = signal<CreditNoteRow[]>([]);
  readonly showForm = signal(false);
  readonly columns = ['number', 'customer', 'reason', 'total', 'status'];

  statusLabel(status: CreditNoteStatus): string {
    return CREDIT_NOTE_STATUS_LABELS[status];
  }

  form: { customerName: string; reason: string; relatedInvoiceRef: string; lines: DraftLine[] } = {
    customerName: '',
    reason: '',
    relatedInvoiceRef: '',
    lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0.2 }],
  };

  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.http.get<CreditNoteRow[]>(`${environment.apiUrl}/credit-notes`).subscribe((data) => this.notes.set(data));
  }

  addLine(): void {
    this.form.lines.push({ description: '', quantity: 1, unitPrice: 0, taxRate: 0.2 });
  }

  removeLine(index: number): void {
    this.form.lines.splice(index, 1);
  }

  draftTotal(): number {
    return this.form.lines.reduce((sum, l) => {
      const net = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
      return sum + net * (1 + (Number(l.taxRate) || 0));
    }, 0);
  }

  isValid(): boolean {
    return (
      !!this.form.customerName.trim() &&
      !!this.form.reason.trim() &&
      this.form.lines.length > 0 &&
      this.form.lines.every((l) => l.description.trim() && l.quantity > 0)
    );
  }

  create(): void {
    const body = {
      customerName: this.form.customerName,
      reason: this.form.reason,
      relatedInvoiceRef: this.form.relatedInvoiceRef || undefined,
      lines: this.form.lines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        taxRate: Number(l.taxRate),
      })),
    };
    this.http.post(`${environment.apiUrl}/credit-notes`, body).subscribe({
      next: () => {
        this.showForm.set(false);
        this.form = {
          customerName: '',
          reason: '',
          relatedInvoiceRef: '',
          lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0.2 }],
        };
        this.load();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not create credit note', 'Dismiss', { duration: 4000 }),
    });
  }
}

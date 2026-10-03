import { CurrencyPipe, DatePipe, PercentPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { CREDIT_NOTE_STATUS_LABELS, CreditNoteStatus } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface CreditNoteLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  lineTotal: string;
}

interface CreditNote {
  id: string;
  number: string | null;
  customerName: string;
  reason: string;
  relatedInvoiceRef: string | null;
  status: CreditNoteStatus;
  subtotal: string;
  taxAmount: string;
  total: string;
  issuedAt: string | null;
  lines: CreditNoteLine[];
}

@Component({
  selector: 'app-credit-note-detail',
  imports: [
    CurrencyPipe,
    DatePipe,
    PercentPipe,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatTableModule,
  ],
  template: `
    @if (note(); as n) {
      <div class="header">
        <button mat-icon-button (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <span class="title">{{ n.number || 'Draft credit note' }}</span>
        <mat-chip [class]="'status-' + n.status">{{ statusLabels[n.status] }}</mat-chip>
      </div>
      <p class="subtitle">
        {{ n.customerName }} · {{ n.reason }}
        @if (n.relatedInvoiceRef) { · re {{ n.relatedInvoiceRef }} }
        @if (n.issuedAt) { · issued {{ n.issuedAt | date: 'mediumDate' }} }
      </p>

      <mat-card class="section">
        <table mat-table [dataSource]="n.lines" class="mat-elevation-z1">
          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef>Description</th>
            <td mat-cell *matCellDef="let l">{{ l.description }}</td>
          </ng-container>
          <ng-container matColumnDef="quantity">
            <th mat-header-cell *matHeaderCellDef>Qty</th>
            <td mat-cell *matCellDef="let l">{{ +l.quantity }}</td>
          </ng-container>
          <ng-container matColumnDef="unitPrice">
            <th mat-header-cell *matHeaderCellDef>Unit</th>
            <td mat-cell *matCellDef="let l">{{ +l.unitPrice | currency: 'GBP' }}</td>
          </ng-container>
          <ng-container matColumnDef="taxRate">
            <th mat-header-cell *matHeaderCellDef>Tax</th>
            <td mat-cell *matCellDef="let l">{{ +l.taxRate | percent }}</td>
          </ng-container>
          <ng-container matColumnDef="lineTotal">
            <th mat-header-cell *matHeaderCellDef>Net</th>
            <td mat-cell *matCellDef="let l">{{ +l.lineTotal | currency: 'GBP' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="lineColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: lineColumns"></tr>
        </table>

        <div class="totals">
          <div><span>Subtotal</span><span>{{ +n.subtotal | currency: 'GBP' }}</span></div>
          <div><span>Tax</span><span>{{ +n.taxAmount | currency: 'GBP' }}</span></div>
          <div class="grand"><span>Total</span><span>{{ +n.total | currency: 'GBP' }}</span></div>
        </div>
      </mat-card>

      <div class="actions">
        @if (n.status === 'DRAFT') {
          <button mat-flat-button color="primary" (click)="act('issue')"><mat-icon>send</mat-icon> Issue</button>
          <button mat-stroked-button color="warn" (click)="act('cancel')">Cancel</button>
        } @else if (n.status === 'ISSUED') {
          <button mat-flat-button color="primary" (click)="act('apply')"><mat-icon>done_all</mat-icon> Mark applied</button>
          <button mat-stroked-button color="warn" (click)="act('cancel')">Cancel</button>
        } @else {
          <p class="muted">No further actions for a {{ statusLabels[n.status].toLowerCase() }} credit note.</p>
        }
      </div>
    }
  `,
  styles: [
    `
      .header {
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
        margin: 4px 0 16px 40px;
      }
      .section {
        padding: 16px;
        margin-bottom: 16px;
        max-width: 720px;
      }
      table {
        width: 100%;
      }
      .totals {
        margin-top: 12px;
        margin-left: auto;
        width: 240px;
      }
      .totals > div {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
      }
      .totals .grand {
        font-weight: 600;
        border-top: 1px solid #ddd;
        margin-top: 4px;
        padding-top: 8px;
      }
      .actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .muted {
        color: rgba(0, 0, 0, 0.5);
      }
      .status-DRAFT {
        background: #eceff1;
      }
      .status-ISSUED {
        background: #e3f2fd;
      }
      .status-APPLIED {
        background: #e8f5e9;
      }
      .status-CANCELLED {
        background: #fbe9e7;
        text-decoration: line-through;
      }
    `,
  ],
})
export class CreditNoteDetailComponent implements OnInit {
  readonly note = signal<CreditNote | null>(null);
  readonly lineColumns = ['description', 'quantity', 'unitPrice', 'taxRate', 'lineTotal'];
  readonly statusLabels = CREDIT_NOTE_STATUS_LABELS;
  private id = '';

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.http.get<CreditNote>(`${environment.apiUrl}/credit-notes/${this.id}`).subscribe((data) => this.note.set(data));
  }

  act(action: 'issue' | 'apply' | 'cancel'): void {
    this.http.post(`${environment.apiUrl}/credit-notes/${this.id}/${action}`, {}).subscribe({
      next: () => this.load(),
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Action failed', 'Dismiss', { duration: 4000 }),
    });
  }

  back(): void {
    this.router.navigate(['/credit-notes']);
  }
}

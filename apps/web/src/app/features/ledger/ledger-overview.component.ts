import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
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
import { MatTabsModule } from '@angular/material/tabs';
import { NOMINAL_ACCOUNT_TYPE_LABELS, NominalAccountType, VAT_CODE_LABELS, VatCode } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface NominalAccount {
  id: string;
  code: string;
  name: string;
  type: NominalAccountType;
  defaultVatCode: VatCode | null;
  isControlAccount: boolean;
  active: boolean;
}

interface JournalLine {
  id: string;
  debit: string | number;
  credit: string | number;
  vatCode: VatCode | null;
  vatAmount: string | number | null;
  description: string | null;
  account: NominalAccount;
}

interface JournalEntry {
  id: string;
  reference: string;
  description: string;
  date: string;
  sourceType: string;
  lines: JournalLine[];
}

interface DraftLine {
  accountCode: string;
  debit: number | null;
  credit: number | null;
}

interface VatReturn {
  id: string;
  periodStart: string;
  periodEnd: string;
  box1VatDueSales: string | number;
  box3TotalVatDue: string | number;
  box4VatReclaimed: string | number;
  box5NetVatDue: string | number;
  box6TotalSalesExVat: string | number;
  box7TotalPurchasesExVat: string | number;
  status: 'DRAFT' | 'SUBMITTED';
  hmrcSubmissionRef: string | null;
}

@Component({
  selector: 'app-ledger-overview',
  imports: [
    CurrencyPipe,
    DatePipe,
    NgTemplateOutlet,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatTabsModule,
  ],
  template: `
    <h1>Nominal Ledger</h1>

    <mat-tab-group>
      <mat-tab label="Chart of accounts">
        <mat-card>
          <h3>Add an account</h3>
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Code</mat-label>
              <input matInput [(ngModel)]="newAccount.code" placeholder="e.g. 5300" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Name</mat-label>
              <input matInput [(ngModel)]="newAccount.name" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Type</mat-label>
              <mat-select [(ngModel)]="newAccount.type">
                @for (t of accountTypes; track t) {
                  <mat-option [value]="t">{{ accountTypeLabels[t] }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Default VAT code</mat-label>
              <mat-select [(ngModel)]="newAccount.defaultVatCode">
                <mat-option [value]="null">None</mat-option>
                @for (v of vatCodes; track v) {
                  <mat-option [value]="v">{{ vatCodeLabels[v] }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <button mat-flat-button color="primary" [disabled]="!newAccount.code || !newAccount.name" (click)="createAccount()">
              Add
            </button>
          </div>
        </mat-card>

        <table mat-table [dataSource]="accounts()" class="mat-elevation-z1">
          <ng-container matColumnDef="code">
            <th mat-header-cell *matHeaderCellDef>Code</th>
            <td mat-cell *matCellDef="let a">{{ a.code }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let a">
              {{ a.name }}
              @if (a.isControlAccount) {
                <mat-chip class="control-chip">control</mat-chip>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let a">{{ accountTypeLabel(a.type) }}</td>
          </ng-container>
          <ng-container matColumnDef="vat">
            <th mat-header-cell *matHeaderCellDef>Default VAT</th>
            <td mat-cell *matCellDef="let a">{{ a.defaultVatCode ? vatCodeLabel(a.defaultVatCode) : '—' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="accountColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: accountColumns"></tr>
        </table>
      </mat-tab>

      <mat-tab label="Journal">
        <mat-card>
          <h3>Post a manual journal</h3>
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Reference</mat-label>
              <input matInput [(ngModel)]="draftJournal.reference" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Description</mat-label>
              <input matInput [(ngModel)]="draftJournal.description" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Date</mat-label>
              <input matInput type="date" [(ngModel)]="draftJournal.date" />
            </mat-form-field>
          </div>

          @for (line of draftJournal.lines; track $index) {
            <div class="row">
              <mat-form-field appearance="outline">
                <mat-label>Account</mat-label>
                <mat-select [(ngModel)]="line.accountCode">
                  @for (a of accounts(); track a.id) {
                    <mat-option [value]="a.code">{{ a.code }} — {{ a.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Debit</mat-label>
                <input matInput type="number" [(ngModel)]="line.debit" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Credit</mat-label>
                <input matInput type="number" [(ngModel)]="line.credit" />
              </mat-form-field>
              <button mat-icon-button (click)="removeLine($index)"><mat-icon>delete</mat-icon></button>
            </div>
          }
          <div class="row">
            <button mat-stroked-button (click)="addLine()">Add line</button>
            <span class="spacer"></span>
            <span>Debit total: {{ draftDebitTotal() | currency: 'GBP' }} · Credit total: {{ draftCreditTotal() | currency: 'GBP' }}</span>
            <button
              mat-flat-button
              color="primary"
              [disabled]="!canPost()"
              (click)="postJournal()"
            >
              Post journal
            </button>
          </div>
        </mat-card>

        <table mat-table [dataSource]="journal()" class="mat-elevation-z1">
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef>Date</th>
            <td mat-cell *matCellDef="let j">{{ j.date | date: 'dd/MM/yyyy' }}</td>
          </ng-container>
          <ng-container matColumnDef="reference">
            <th mat-header-cell *matHeaderCellDef>Reference</th>
            <td mat-cell *matCellDef="let j">{{ j.reference }}</td>
          </ng-container>
          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef>Description</th>
            <td mat-cell *matCellDef="let j">{{ j.description }}</td>
          </ng-container>
          <ng-container matColumnDef="source">
            <th mat-header-cell *matHeaderCellDef>Source</th>
            <td mat-cell *matCellDef="let j"><mat-chip>{{ j.sourceType }}</mat-chip></td>
          </ng-container>
          <ng-container matColumnDef="total">
            <th mat-header-cell *matHeaderCellDef>Total</th>
            <td mat-cell *matCellDef="let j">{{ journalTotal(j) | currency: 'GBP' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="journalColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: journalColumns"></tr>
        </table>
      </mat-tab>

      <mat-tab label="Sales ledger">
        <ng-container *ngTemplateOutlet="ledgerTable; context: { $implicit: salesLedger() }"></ng-container>
      </mat-tab>
      <mat-tab label="Purchase ledger">
        <ng-container *ngTemplateOutlet="ledgerTable; context: { $implicit: purchaseLedger() }"></ng-container>
      </mat-tab>
      <mat-tab label="Vehicle ledger">
        <ng-container *ngTemplateOutlet="ledgerTable; context: { $implicit: vehicleLedger() }"></ng-container>
      </mat-tab>

      <mat-tab label="VAT return (MTD)">
        <mat-card>
          <h3>Compute a return</h3>
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Period start</mat-label>
              <input matInput type="date" [(ngModel)]="vatPeriodStart" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Period end</mat-label>
              <input matInput type="date" [(ngModel)]="vatPeriodEnd" />
            </mat-form-field>
            <button mat-stroked-button [disabled]="!vatPeriodStart || !vatPeriodEnd" (click)="computeVat()">Compute</button>
            <button mat-flat-button color="primary" [disabled]="!vatPreview()" (click)="saveVat()">Save as draft</button>
          </div>
          @if (vatPreview(); as v) {
            <table class="vat-boxes">
              <tr><td>Box 1 — VAT due on sales</td><td>{{ v.box1VatDueSales | currency: 'GBP' }}</td></tr>
              <tr><td>Box 3 — Total VAT due</td><td>{{ v.box3TotalVatDue | currency: 'GBP' }}</td></tr>
              <tr><td>Box 4 — VAT reclaimed</td><td>{{ v.box4VatReclaimed | currency: 'GBP' }}</td></tr>
              <tr><td><b>Box 5 — Net VAT due</b></td><td><b>{{ v.box5NetVatDue | currency: 'GBP' }}</b></td></tr>
              <tr><td>Box 6 — Total sales (ex VAT)</td><td>{{ v.box6TotalSalesExVat | currency: 'GBP' }}</td></tr>
              <tr><td>Box 7 — Total purchases (ex VAT)</td><td>{{ v.box7TotalPurchasesExVat | currency: 'GBP' }}</td></tr>
            </table>
          }
        </mat-card>

        <table mat-table [dataSource]="vatReturns()" class="mat-elevation-z1">
          <ng-container matColumnDef="period">
            <th mat-header-cell *matHeaderCellDef>Period</th>
            <td mat-cell *matCellDef="let r">{{ r.periodStart | date: 'dd/MM/yy' }} – {{ r.periodEnd | date: 'dd/MM/yy' }}</td>
          </ng-container>
          <ng-container matColumnDef="netVat">
            <th mat-header-cell *matHeaderCellDef>Net VAT due</th>
            <td mat-cell *matCellDef="let r">{{ r.box5NetVatDue | currency: 'GBP' }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let r">
              <mat-chip>{{ r.status }}</mat-chip>
              @if (r.hmrcSubmissionRef) {
                <span class="ref">{{ r.hmrcSubmissionRef }}</span>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let r">
              @if (r.status === 'DRAFT') {
                <button mat-button color="primary" (click)="submitVat(r.id)">Submit via MTD</button>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="vatColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: vatColumns"></tr>
        </table>
      </mat-tab>
    </mat-tab-group>

    <ng-template #ledgerTable let-lines>
      <table mat-table [dataSource]="lines" class="mat-elevation-z1">
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Date</th>
          <td mat-cell *matCellDef="let l">{{ l.journalEntry.date | date: 'dd/MM/yyyy' }}</td>
        </ng-container>
        <ng-container matColumnDef="reference">
          <th mat-header-cell *matHeaderCellDef>Reference</th>
          <td mat-cell *matCellDef="let l">{{ l.journalEntry.reference }}</td>
        </ng-container>
        <ng-container matColumnDef="description">
          <th mat-header-cell *matHeaderCellDef>Description</th>
          <td mat-cell *matCellDef="let l">{{ l.journalEntry.description }}</td>
        </ng-container>
        <ng-container matColumnDef="debit">
          <th mat-header-cell *matHeaderCellDef>Debit</th>
          <td mat-cell *matCellDef="let l">{{ +l.debit > 0 ? (l.debit | currency: 'GBP') : '' }}</td>
        </ng-container>
        <ng-container matColumnDef="credit">
          <th mat-header-cell *matHeaderCellDef>Credit</th>
          <td mat-cell *matCellDef="let l">{{ +l.credit > 0 ? (l.credit | currency: 'GBP') : '' }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="ledgerColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: ledgerColumns"></tr>
      </table>
    </ng-template>
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
      .spacer {
        flex: 1;
      }
      table {
        width: 100%;
        margin-bottom: 16px;
      }
      .control-chip {
        margin-left: 8px;
        font-size: 11px;
        min-height: 20px;
        padding: 0 8px;
      }
      .vat-boxes {
        border-collapse: collapse;
      }
      .vat-boxes td {
        padding: 4px 16px 4px 0;
      }
      .ref {
        margin-left: 8px;
        font-size: 12px;
        color: #666;
      }
    `,
  ],
})
export class LedgerOverviewComponent implements OnInit {
  readonly accounts = signal<NominalAccount[]>([]);
  readonly journal = signal<JournalEntry[]>([]);
  readonly salesLedger = signal<JournalLine[]>([]);
  readonly purchaseLedger = signal<JournalLine[]>([]);
  readonly vehicleLedger = signal<JournalLine[]>([]);
  readonly vatReturns = signal<VatReturn[]>([]);
  readonly vatPreview = signal<VatReturn | null>(null);

  readonly accountColumns = ['code', 'name', 'type', 'vat'];
  readonly journalColumns = ['date', 'reference', 'description', 'source', 'total'];
  readonly ledgerColumns = ['date', 'reference', 'description', 'debit', 'credit'];
  readonly vatColumns = ['period', 'netVat', 'status', 'actions'];

  readonly accountTypes = Object.values(NominalAccountType);
  readonly accountTypeLabels = NOMINAL_ACCOUNT_TYPE_LABELS;
  readonly vatCodes = Object.values(VatCode);
  readonly vatCodeLabels = VAT_CODE_LABELS;

  newAccount: { code: string; name: string; type: NominalAccountType; defaultVatCode: VatCode | null } = {
    code: '',
    name: '',
    type: NominalAccountType.EXPENSE,
    defaultVatCode: null,
  };

  draftJournal: { reference: string; description: string; date: string; lines: DraftLine[] } = {
    reference: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
    lines: [
      { accountCode: '', debit: null, credit: null },
      { accountCode: '', debit: null, credit: null },
    ],
  };

  vatPeriodStart = '';
  vatPeriodEnd = '';

  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.http.get<NominalAccount[]>(`${environment.apiUrl}/ledger/accounts`).subscribe((data) => this.accounts.set(data));
    this.http.get<JournalEntry[]>(`${environment.apiUrl}/ledger/journal`).subscribe((data) => this.journal.set(data));
    this.http.get<JournalLine[]>(`${environment.apiUrl}/ledger/sales-ledger`).subscribe((data) => this.salesLedger.set(data));
    this.http.get<JournalLine[]>(`${environment.apiUrl}/ledger/purchase-ledger`).subscribe((data) => this.purchaseLedger.set(data));
    this.http.get<JournalLine[]>(`${environment.apiUrl}/ledger/vehicle-ledger`).subscribe((data) => this.vehicleLedger.set(data));
    this.http.get<VatReturn[]>(`${environment.apiUrl}/ledger/vat-returns`).subscribe((data) => this.vatReturns.set(data));
  }

  createAccount(): void {
    this.http.post(`${environment.apiUrl}/ledger/accounts`, this.newAccount).subscribe(() => {
      this.newAccount = { code: '', name: '', type: NominalAccountType.EXPENSE, defaultVatCode: null };
      this.load();
    });
  }

  addLine(): void {
    this.draftJournal.lines.push({ accountCode: '', debit: null, credit: null });
  }

  removeLine(index: number): void {
    this.draftJournal.lines.splice(index, 1);
  }

  draftDebitTotal(): number {
    return this.draftJournal.lines.reduce((sum, l) => sum + (l.debit ?? 0), 0);
  }

  draftCreditTotal(): number {
    return this.draftJournal.lines.reduce((sum, l) => sum + (l.credit ?? 0), 0);
  }

  canPost(): boolean {
    const hasLines = this.draftJournal.lines.every((l) => l.accountCode && (l.debit || l.credit));
    return (
      !!this.draftJournal.reference &&
      !!this.draftJournal.description &&
      hasLines &&
      Math.abs(this.draftDebitTotal() - this.draftCreditTotal()) < 0.005
    );
  }

  accountTypeLabel(type: NominalAccountType): string {
    return this.accountTypeLabels[type];
  }

  vatCodeLabel(code: VatCode): string {
    return this.vatCodeLabels[code];
  }

  journalTotal(entry: JournalEntry): number {
    return entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  }

  postJournal(): void {
    this.http.post(`${environment.apiUrl}/ledger/journal`, this.draftJournal).subscribe({
      next: () => {
        this.draftJournal = {
          reference: '',
          description: '',
          date: new Date().toISOString().slice(0, 10),
          lines: [
            { accountCode: '', debit: null, credit: null },
            { accountCode: '', debit: null, credit: null },
          ],
        };
        this.load();
        this.snackBar.open('Journal posted', 'Dismiss', { duration: 3000 });
      },
      error: (err) => this.snackBar.open(err.error?.message ?? 'Failed to post journal', 'Dismiss', { duration: 5000 }),
    });
  }

  computeVat(): void {
    this.http
      .get<VatReturn>(`${environment.apiUrl}/ledger/vat-return/compute`, {
        params: { periodStart: this.vatPeriodStart, periodEnd: this.vatPeriodEnd },
      })
      .subscribe((data) => this.vatPreview.set(data));
  }

  saveVat(): void {
    this.http
      .post(`${environment.apiUrl}/ledger/vat-returns`, { periodStart: this.vatPeriodStart, periodEnd: this.vatPeriodEnd })
      .subscribe(() => {
        this.vatPreview.set(null);
        this.load();
        this.snackBar.open('VAT return saved as draft', 'Dismiss', { duration: 3000 });
      });
  }

  submitVat(id: string): void {
    this.http.post(`${environment.apiUrl}/ledger/vat-returns/${id}/submit`, {}).subscribe({
      next: () => {
        this.load();
        this.snackBar.open('Submitted to HMRC via Making Tax Digital', 'Dismiss', { duration: 4000 });
      },
      error: (err) => this.snackBar.open(err.error?.message ?? 'Submission failed', 'Dismiss', { duration: 5000 }),
    });
  }
}

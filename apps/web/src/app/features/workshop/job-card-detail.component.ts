import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DamageSeverity, JOB_BILLING_TYPE_LABELS, JOB_CATEGORY_LABELS, JobBillingType, JobCategory } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface JobCard {
  id: string;
  customerName: string;
  vehicleReg: string | null;
  jobType: string;
  category: JobCategory;
  billingType: JobBillingType;
  status: string;
  estimatedHours: number;
  timeEntries: { id: string; clockOn: string; clockOff: string | null; technician: { firstName: string; lastName: string } }[];
  partAllocations: { id: string; quantity: number; part: { partNumber: string; description: string; costPrice: number } }[];
  partRequirements: { id: string; description: string; quantity: number; part: { partNumber: string } | null }[];
}

interface JobCardOperationLine {
  id: string;
  description: string;
  estimatedMinutes: number | null;
  clockEntries: { id: string; clockOn: string; clockOff: string | null; technician: { firstName: string; lastName: string } }[];
}

interface DamageMarker {
  location: string;
  description: string;
  severity: DamageSeverity;
}

interface ConditionReport {
  id: string;
  stage: 'INITIAL' | 'FINAL';
  mileage: number | null;
  notes: string | null;
  damageMarkers: DamageMarker[];
}

interface Invoice {
  invoiceNumber: string;
  isInternal: boolean;
  recipient: string | null;
  labourTotal: number;
  partsTotal: number;
  vatAmount: number;
  totalAmount: number;
  pdfUrl: string | null;
}

@Component({
  selector: 'app-job-card-detail',
  imports: [DatePipe, FormsModule, RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    @if (jobCard(); as jc) {
      <div class="header">
        <div>
          <button mat-icon-button (click)="back()"><mat-icon>arrow_back</mat-icon></button>
          <span class="title">{{ jc.customerName }}</span>
          <mat-chip>{{ jc.status }}</mat-chip>
        </div>
      </div>
      <p class="subtitle">{{ jc.jobType }} @if (jc.vehicleReg) { · {{ jc.vehicleReg }} }</p>

      <div class="row classification">
        <mat-form-field appearance="outline">
          <mat-label>Job category</mat-label>
          <mat-select [(ngModel)]="jc.category" (selectionChange)="updateClassification(jc)">
            @for (c of categories; track c) {
              <mat-option [value]="c">{{ categoryLabels[c] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Billed to</mat-label>
          <mat-select [(ngModel)]="jc.billingType" (selectionChange)="updateClassification(jc)">
            @for (b of billingTypes; track b) {
              <mat-option [value]="b">{{ billingTypeLabels[b] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <div class="columns">
        <mat-card class="col">
          <h3>Time entries</h3>
          @for (t of jc.timeEntries; track t.id) {
            <div class="line-item">
              <span>{{ t.technician.firstName }} {{ t.technician.lastName }}</span>
              <span>{{ t.clockOn | date: 'HH:mm' }} – {{ t.clockOff ? (t.clockOff | date: 'HH:mm') : 'still on' }}</span>
            </div>
          } @empty {
            <p class="hint">No time clocked yet — the invoice will use the {{ jc.estimatedHours }}h estimate.</p>
          }

          <h3>Operation lines</h3>
          <p class="hint">Once a job is broken into lines, invoicing sums their clocked time instead of the whole-job entries above.</p>
          @for (line of operationLines(); track line.id) {
            <div class="op-line">
              <div class="op-line-header">
                <span>{{ line.description }}</span>
                @if (line.estimatedMinutes) { <span class="hint">{{ line.estimatedMinutes }} min est.</span> }
              </div>
              @for (e of line.clockEntries; track e.id) {
                <div class="line-item">
                  <span>{{ e.technician.firstName }} {{ e.technician.lastName }}</span>
                  <span>{{ e.clockOn | date: 'HH:mm' }} – {{ e.clockOff ? (e.clockOff | date: 'HH:mm') : 'still on' }}</span>
                </div>
              }
              <div class="row">
                @if (openClockEntry(line)) {
                  <button mat-stroked-button (click)="clockOffLine(line.id)">Clock off</button>
                } @else {
                  <button mat-stroked-button (click)="clockOnLine(line.id)">Clock on</button>
                }
              </div>
            </div>
          } @empty {
            <p class="hint">No operation lines yet.</p>
          }
          <div class="row">
            <mat-form-field appearance="outline" class="grow">
              <mat-label>Line description</mat-label>
              <input matInput [(ngModel)]="lineForm.description" placeholder="e.g. Front brake pads" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Est. minutes</mat-label>
              <input matInput type="number" [(ngModel)]="lineForm.estimatedMinutes" />
            </mat-form-field>
            <button mat-stroked-button [disabled]="!lineForm.description" (click)="addLine()">+ Add line</button>
          </div>

          <h3>Parts allocated</h3>
          @for (a of jc.partAllocations; track a.id) {
            <div class="line-item">
              <span>{{ a.part.partNumber }} — {{ a.part.description }}</span>
              <span>x{{ a.quantity }}</span>
            </div>
          } @empty {
            <p class="hint">No parts allocated yet.</p>
          }
        </mat-card>

        <mat-card class="col">
          <h3>Parts needed (for upcoming shortfall tracking)</h3>
          @for (r of partRequirements(); track r.id) {
            <div class="line-item">
              <span>{{ r.description }} {{ r.part ? '(' + r.part.partNumber + ')' : '' }}</span>
              <span>
                x{{ r.quantity }}
                <button mat-icon-button (click)="removeRequirement(r.id)"><mat-icon>close</mat-icon></button>
              </span>
            </div>
          } @empty {
            <p class="hint">No parts logged as needed for this job yet.</p>
          }
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Description</mat-label>
              <input matInput [(ngModel)]="requirementDescription" placeholder="e.g. Rear brake disc" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Qty</mat-label>
              <input matInput type="number" [(ngModel)]="requirementQuantity" />
            </mat-form-field>
            <button mat-stroked-button [disabled]="!requirementDescription" (click)="addRequirement()">+ Add</button>
          </div>

          <h3>Aftersales invoice</h3>
          @if (jc.billingType === 'WARRANTY') {
            <p class="hint">Warranty job — claimed from the OEM, not invoiced to the customer.</p>
            <a mat-stroked-button routerLink="/warranty">Go to Warranty</a>
          } @else if (invoice(); as inv) {
            <p>
              {{ inv.isInternal ? 'Internal cost record' : 'Invoice' }} {{ inv.invoiceNumber }}
              @if (inv.isInternal) { <mat-chip class="internal-chip">Internal — not customer payable</mat-chip> }
            </p>
            @if (inv.recipient) { <p class="hint">Billed to: {{ inv.recipient }}</p> }
            <p>Labour: £{{ inv.labourTotal }} · Parts: £{{ inv.partsTotal }} · VAT: £{{ inv.vatAmount }}</p>
            <p><b>Total: £{{ inv.totalAmount }}</b></p>
            @if (inv.pdfUrl) {
              <a [href]="storageUrl(inv.pdfUrl)" target="_blank" rel="noopener">View invoice document</a>
            }
          } @else {
            <button mat-flat-button color="primary" (click)="generateInvoice()">
              {{ jc.billingType === 'INTERNAL' ? 'Generate internal cost record' : 'Generate invoice' }}
            </button>
          }
        </mat-card>

        <mat-card class="col">
          <h3>Vehicle condition</h3>
          @for (r of conditionReports(); track r.id) {
            <div class="condition-report">
              <mat-chip>{{ r.stage }}</mat-chip>
              <span>{{ r.mileage !== null ? r.mileage + ' miles' : '' }}</span>
              @if (r.notes) { <p class="hint">{{ r.notes }}</p> }
              @for (m of r.damageMarkers; track m.location) {
                <div class="line-item">
                  <span>{{ m.location }} — {{ m.description }}</span>
                  <span>{{ m.severity }}</span>
                </div>
              }
            </div>
          } @empty {
            <p class="hint">No condition checks logged yet.</p>
          }

          <mat-form-field appearance="outline">
            <mat-label>Stage</mat-label>
            <mat-select [(ngModel)]="conditionForm.stage">
              <mat-option value="INITIAL">Initial (drop-off)</mat-option>
              <mat-option value="FINAL">Final (handback)</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Mileage</mat-label>
            <input matInput type="number" [(ngModel)]="conditionForm.mileage" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Notes</mat-label>
            <textarea matInput rows="2" [(ngModel)]="conditionForm.notes"></textarea>
          </mat-form-field>

          @for (m of damageMarkers(); track $index) {
            <div class="row">
              <mat-form-field appearance="outline">
                <mat-label>Location</mat-label>
                <input matInput [(ngModel)]="m.location" placeholder="e.g. rear bumper" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="grow">
                <mat-label>Description</mat-label>
                <input matInput [(ngModel)]="m.description" placeholder="e.g. scratch" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Severity</mat-label>
                <mat-select [(ngModel)]="m.severity">
                  @for (s of severities; track s) {
                    <mat-option [value]="s">{{ s }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <button mat-icon-button (click)="removeDamageMarker($index)"><mat-icon>close</mat-icon></button>
            </div>
          }
          <button mat-button (click)="addDamageMarker()"><mat-icon>add</mat-icon> Add damage marker</button>
          <button mat-stroked-button (click)="recordConditionCheck()">Log condition check</button>
        </mat-card>
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
      .columns {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 16px;
      }
      .condition-report {
        border-bottom: 1px solid #eee;
        padding-bottom: 8px;
        margin-bottom: 4px;
      }
      .grow {
        flex: 1;
      }
      .full-width {
        width: 100%;
      }
      .col {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .line-item {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px solid #eee;
        padding: 6px 0;
        font-size: 13px;
      }
      .hint {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.5);
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
        margin: 8px 0;
      }
      .classification {
        margin-left: 40px;
      }
      .internal-chip {
        background: #fbe9e7;
        font-size: 11px;
      }
      .op-line {
        border-bottom: 1px solid #eee;
        padding: 6px 0;
      }
      .op-line-header {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        margin-bottom: 4px;
      }
    `,
  ],
})
export class JobCardDetailComponent implements OnInit {
  readonly jobCard = signal<JobCard | null>(null);
  readonly partRequirements = signal<JobCard['partRequirements']>([]);
  readonly operationLines = signal<JobCardOperationLine[]>([]);
  readonly invoice = signal<Invoice | null>(null);
  readonly conditionReports = signal<ConditionReport[]>([]);
  readonly damageMarkers = signal<DamageMarker[]>([]);
  readonly severities = Object.values(DamageSeverity);
  readonly categories = Object.values(JobCategory);
  readonly billingTypes = Object.values(JobBillingType);
  readonly categoryLabels = JOB_CATEGORY_LABELS;
  readonly billingTypeLabels = JOB_BILLING_TYPE_LABELS;
  readonly apiUrl = environment.apiUrl;

  requirementDescription = '';
  requirementQuantity: number | null = 1;
  lineForm: { description: string; estimatedMinutes: number | null } = { description: '', estimatedMinutes: null };
  conditionForm: { stage: 'INITIAL' | 'FINAL'; mileage: number | null; notes: string } = {
    stage: 'INITIAL',
    mileage: null,
    notes: '',
  };

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private jobCardId = '';

  ngOnInit(): void {
    this.jobCardId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
    this.loadInvoice();
    this.loadConditionReports();
    this.loadOperationLines();
  }

  load(): void {
    this.http.get<JobCard>(`${environment.apiUrl}/job-cards/${this.jobCardId}`).subscribe((data) => {
      this.jobCard.set(data);
      this.partRequirements.set(data.partRequirements);
    });
  }

  loadInvoice(): void {
    this.http.get<Invoice>(`${environment.apiUrl}/job-cards/${this.jobCardId}/invoice`).subscribe({
      next: (data) => this.invoice.set(data),
      error: () => this.invoice.set(null),
    });
  }

  addRequirement(): void {
    this.http
      .post(`${environment.apiUrl}/job-cards/${this.jobCardId}/part-requirements`, {
        description: this.requirementDescription,
        quantity: this.requirementQuantity ?? 1,
      })
      .subscribe(() => {
        this.requirementDescription = '';
        this.requirementQuantity = 1;
        this.load();
      });
  }

  removeRequirement(id: string): void {
    this.http.delete(`${environment.apiUrl}/part-requirements/${id}`).subscribe(() => this.load());
  }

  updateClassification(jc: JobCard): void {
    this.http
      .patch(`${environment.apiUrl}/job-cards/${this.jobCardId}`, { category: jc.category, billingType: jc.billingType })
      .subscribe({
        error: (err) => {
          this.snackBar.open(err?.error?.message ?? 'Could not update job classification', 'Dismiss', { duration: 4000 });
          this.load();
        },
      });
  }

  generateInvoice(): void {
    this.http.post<Invoice>(`${environment.apiUrl}/job-cards/${this.jobCardId}/invoice`, {}).subscribe({
      next: (invoice) => this.invoice.set(invoice),
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not generate invoice', 'Dismiss', { duration: 4000 }),
    });
  }

  loadConditionReports(): void {
    this.http
      .get<ConditionReport[]>(`${environment.apiUrl}/job-cards/${this.jobCardId}/condition-checks`)
      .subscribe((data) => this.conditionReports.set(data));
  }

  addDamageMarker(): void {
    this.damageMarkers.update((m) => [...m, { location: '', description: '', severity: DamageSeverity.MINOR }]);
  }

  removeDamageMarker(index: number): void {
    this.damageMarkers.update((m) => m.filter((_, i) => i !== index));
  }

  recordConditionCheck(): void {
    const markers = this.damageMarkers().filter((m) => m.location && m.description);
    this.http
      .post(`${environment.apiUrl}/job-cards/${this.jobCardId}/condition-checks`, { ...this.conditionForm, damageMarkers: markers })
      .subscribe({
        next: () => {
          this.conditionForm = { stage: 'INITIAL', mileage: null, notes: '' };
          this.damageMarkers.set([]);
          this.loadConditionReports();
        },
        error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not log condition check', 'Dismiss', { duration: 4000 }),
      });
  }

  loadOperationLines(): void {
    this.http
      .get<JobCardOperationLine[]>(`${environment.apiUrl}/job-cards/${this.jobCardId}/operation-lines`)
      .subscribe((data) => this.operationLines.set(data));
  }

  openClockEntry(line: JobCardOperationLine): boolean {
    return line.clockEntries.some((e) => !e.clockOff);
  }

  addLine(): void {
    this.http.post(`${environment.apiUrl}/job-cards/${this.jobCardId}/operation-lines`, this.lineForm).subscribe({
      next: () => {
        this.lineForm = { description: '', estimatedMinutes: null };
        this.loadOperationLines();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not add line', 'Dismiss', { duration: 4000 }),
    });
  }

  clockOnLine(lineId: string): void {
    this.http.post(`${environment.apiUrl}/operation-lines/${lineId}/clock-on`, {}).subscribe({
      next: () => this.loadOperationLines(),
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not clock on', 'Dismiss', { duration: 4000 }),
    });
  }

  clockOffLine(lineId: string): void {
    this.http.post(`${environment.apiUrl}/operation-lines/${lineId}/clock-off`, {}).subscribe({
      next: () => this.loadOperationLines(),
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not clock off', 'Dismiss', { duration: 4000 }),
    });
  }

  storageUrl(path: string): string {
    return `${environment.apiUrl.replace(/\/api$/, '')}${path}`;
  }

  back(): void {
    this.router.navigate(['/workshop']);
  }
}

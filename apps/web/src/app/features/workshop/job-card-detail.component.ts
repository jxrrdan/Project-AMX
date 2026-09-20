import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';

interface JobCard {
  id: string;
  customerName: string;
  vehicleReg: string | null;
  jobType: string;
  status: string;
  estimatedHours: number;
  timeEntries: { id: string; clockOn: string; clockOff: string | null; technician: { firstName: string; lastName: string } }[];
  partAllocations: { id: string; quantity: number; part: { partNumber: string; description: string; costPrice: number } }[];
  partRequirements: { id: string; description: string; quantity: number; part: { partNumber: string } | null }[];
}

interface Invoice {
  invoiceNumber: string;
  labourTotal: number;
  partsTotal: number;
  vatAmount: number;
  totalAmount: number;
  pdfUrl: string | null;
}

@Component({
  selector: 'app-job-card-detail',
  imports: [DatePipe, FormsModule, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule],
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
          @if (invoice(); as inv) {
            <p>Invoice {{ inv.invoiceNumber }}</p>
            <p>Labour: £{{ inv.labourTotal }} · Parts: £{{ inv.partsTotal }} · VAT: £{{ inv.vatAmount }}</p>
            <p><b>Total: £{{ inv.totalAmount }}</b></p>
            @if (inv.pdfUrl) {
              <a [href]="storageUrl(inv.pdfUrl)" target="_blank" rel="noopener">View invoice document</a>
            }
          } @else {
            <button mat-flat-button color="primary" (click)="generateInvoice()">Generate invoice</button>
          }
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
        grid-template-columns: 1fr 1fr;
        gap: 16px;
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
    `,
  ],
})
export class JobCardDetailComponent implements OnInit {
  readonly jobCard = signal<JobCard | null>(null);
  readonly partRequirements = signal<JobCard['partRequirements']>([]);
  readonly invoice = signal<Invoice | null>(null);
  readonly apiUrl = environment.apiUrl;

  requirementDescription = '';
  requirementQuantity: number | null = 1;

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private jobCardId = '';

  ngOnInit(): void {
    this.jobCardId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
    this.loadInvoice();
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

  generateInvoice(): void {
    this.http.post<Invoice>(`${environment.apiUrl}/job-cards/${this.jobCardId}/invoice`, {}).subscribe({
      next: (invoice) => this.invoice.set(invoice),
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not generate invoice', 'Dismiss', { duration: 4000 }),
    });
  }

  storageUrl(path: string): string {
    return `${environment.apiUrl.replace(/\/api$/, '')}${path}`;
  }

  back(): void {
    this.router.navigate(['/workshop']);
  }
}

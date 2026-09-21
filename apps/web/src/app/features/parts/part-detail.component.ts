import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IntegrationTargetEntity, StockMovementType } from '@project-amx/shared';
import { CustomFieldsPanelComponent } from '../integrations/custom-fields-panel.component';
import { environment } from '../../../environments/environment';

interface PartDetail {
  id: string;
  partNumber: string;
  description: string;
  binLocation: string | null;
  quantityOnHand: number;
  reorderLevel: number;
  costPrice: number;
  movements: { id: string; type: string; quantity: number; reasonCode: string | null; reference: string | null; createdAt: string }[];
  allocations: { id: string; quantity: number; jobCard: { customerName: string; vehicleReg: string | null } }[];
}

interface JobCardOption {
  id: string;
  customerName: string;
  vehicleReg: string | null;
}

@Component({
  selector: 'app-part-detail',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    CustomFieldsPanelComponent,
  ],
  template: `
    @if (part(); as p) {
      <div class="header">
        <div>
          <h1>{{ p.partNumber }}</h1>
          <p class="meta">{{ p.description }} · Bin {{ p.binLocation }}</p>
        </div>
        <a mat-stroked-button routerLink="/parts">
          <mat-icon>arrow_back</mat-icon>
          All parts
        </a>
      </div>

      <div class="columns">
        <div class="col">
          <mat-card>
            <h3>Stock levels</h3>
            <p>
              On hand: <mat-chip [class.low]="p.quantityOnHand <= p.reorderLevel">{{ p.quantityOnHand }}</mat-chip>
              · Reorder level: {{ p.reorderLevel }} · Cost: {{ p.costPrice | currency: 'GBP' }}
            </p>

            <h3>Record a movement</h3>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Type</mat-label>
              <mat-select [(ngModel)]="movementForm.type">
                <mat-option value="GOODS_RECEIVED">Goods received</mat-option>
                <mat-option value="RETURNED">Returned to stock</mat-option>
                <mat-option value="WRITE_OFF">Write-off</mat-option>
              </mat-select>
            </mat-form-field>
            <div class="row">
              <mat-form-field appearance="outline">
                <mat-label>Quantity</mat-label>
                <input matInput type="number" [(ngModel)]="movementForm.quantity" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Reason code (for write-offs)</mat-label>
                <input matInput [(ngModel)]="movementForm.reasonCode" />
              </mat-form-field>
            </div>
            <button mat-flat-button color="primary" [disabled]="!movementForm.quantity" (click)="recordMovement()">
              Record movement
            </button>

            <h3>Allocate to a job</h3>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Job card</mat-label>
              <mat-select [(ngModel)]="allocateForm.jobCardId">
                @for (j of jobCards(); track j.id) {
                  <mat-option [value]="j.id">{{ j.customerName }} — {{ j.vehicleReg }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <div class="row">
              <mat-form-field appearance="outline">
                <mat-label>Quantity</mat-label>
                <input matInput type="number" [(ngModel)]="allocateForm.quantity" />
              </mat-form-field>
              <button mat-flat-button color="primary" [disabled]="!allocateForm.jobCardId || !allocateForm.quantity" (click)="allocate()">
                Allocate
              </button>
            </div>
          </mat-card>
        </div>

        <div class="col">
          <mat-card>
            <h3>Movement history</h3>
            @for (m of p.movements; track m.id) {
              <div class="line-item">
                <span class="type">{{ m.type }}</span>
                <span>{{ m.quantity }}</span>
                <span class="date">{{ m.createdAt | date: 'd MMM, HH:mm' }}</span>
              </div>
            } @empty {
              <p class="empty">No movements recorded yet.</p>
            }
          </mat-card>

          <mat-card>
            <h3>Allocations</h3>
            @for (a of p.allocations; track a.id) {
              <div class="line-item">
                <span>{{ a.jobCard.customerName }} — {{ a.jobCard.vehicleReg }}</span>
                <span>×{{ a.quantity }}</span>
              </div>
            } @empty {
              <p class="empty">Not allocated to any jobs yet.</p>
            }
          </mat-card>
        </div>
      </div>

      <app-custom-fields-panel [entity]="partEntity" [recordId]="p.id" />
    }
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
      }
      .meta {
        color: rgba(0, 0, 0, 0.6);
      }
      .columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      mat-card {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .full-width {
        width: 100%;
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .row mat-form-field {
        flex: 1;
      }
      .low {
        background: #ffcdd2;
      }
      .line-item {
        border-bottom: 1px solid #eee;
        padding: 8px 0;
        display: flex;
        justify-content: space-between;
        font-size: 13px;
      }
      .type {
        font-weight: 600;
      }
      .date {
        color: rgba(0, 0, 0, 0.5);
      }
      .empty {
        color: rgba(0, 0, 0, 0.5);
        font-size: 13px;
      }
    `,
  ],
})
export class PartDetailComponent implements OnInit {
  readonly part = signal<PartDetail | null>(null);
  readonly jobCards = signal<JobCardOption[]>([]);
  readonly partEntity = IntegrationTargetEntity.PART;

  movementForm = { type: StockMovementType.GOODS_RECEIVED as string, quantity: null as number | null, reasonCode: '' };
  allocateForm = { jobCardId: '', quantity: null as number | null };

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private partId = '';

  ngOnInit(): void {
    this.partId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
    this.http.get<JobCardOption[]>(`${environment.apiUrl}/job-cards`).subscribe((data) => this.jobCards.set(data));
  }

  load(): void {
    this.http.get<PartDetail>(`${environment.apiUrl}/parts/${this.partId}`).subscribe((data) => this.part.set(data));
  }

  recordMovement(): void {
    this.http
      .post(`${environment.apiUrl}/parts/movements`, { partId: this.partId, ...this.movementForm })
      .subscribe({
        next: () => {
          this.movementForm = { type: StockMovementType.GOODS_RECEIVED, quantity: null, reasonCode: '' };
          this.load();
        },
        error: () => this.snackBar.open('Could not record that movement — check the quantity', 'Dismiss', { duration: 3000 }),
      });
  }

  allocate(): void {
    this.http.post(`${environment.apiUrl}/parts/allocate`, { partId: this.partId, ...this.allocateForm }).subscribe({
      next: () => {
        this.allocateForm = { jobCardId: '', quantity: null };
        this.load();
      },
      error: () => this.snackBar.open('Could not allocate — insufficient stock?', 'Dismiss', { duration: 3000 }),
    });
  }
}

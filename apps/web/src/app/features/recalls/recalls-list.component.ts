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
import { MatTableModule } from '@angular/material/table';
import { RECALL_CAMPAIGN_STATUS_LABELS, RecallCampaignStatus } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface CampaignRow {
  id: string;
  code: string;
  title: string;
  status: RecallCampaignStatus;
  affectedModels: string | null;
  totalVehicles: number;
  outstanding: number;
  booked: number;
  completed: number;
}

interface RecallSummary {
  openCampaigns: number;
  outstanding: number;
  booked: number;
  completed: number;
}

@Component({
  selector: 'app-recalls-list',
  imports: [
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
      <h1>Recall Campaigns</h1>
      <button mat-flat-button color="primary" (click)="showForm.set(!showForm())">
        <mat-icon>add</mat-icon> New campaign
      </button>
    </div>

    @if (summary(); as s) {
      <div class="tiles">
        <mat-card class="tile"><span class="num">{{ s.openCampaigns }}</span><span>Open campaigns</span></mat-card>
        <mat-card class="tile warn"><span class="num">{{ s.outstanding }}</span><span>Outstanding</span></mat-card>
        <mat-card class="tile info"><span class="num">{{ s.booked }}</span><span>Booked</span></mat-card>
        <mat-card class="tile ok"><span class="num">{{ s.completed }}</span><span>Completed</span></mat-card>
      </div>
    }

    @if (showForm()) {
      <mat-card class="form-card">
        <mat-form-field appearance="outline">
          <mat-label>Campaign code</mat-label>
          <input matInput [(ngModel)]="form.code" placeholder="e.g. 0067340700" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Title</mat-label>
          <input matInput [(ngModel)]="form.title" placeholder="e.g. Front airbag inflator inspection" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Affected models (optional)</mat-label>
          <input matInput [(ngModel)]="form.affectedModels" placeholder="e.g. 3 Series (G20), 4 Series (G22)" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description (optional)</mat-label>
          <textarea matInput rows="2" [(ngModel)]="form.description"></textarea>
        </mat-form-field>
        <button mat-flat-button color="primary" [disabled]="!form.code || !form.title" (click)="create()">
          Create campaign
        </button>
      </mat-card>
    }

    <table mat-table [dataSource]="campaigns()" class="mat-elevation-z1">
      <ng-container matColumnDef="code">
        <th mat-header-cell *matHeaderCellDef>Code</th>
        <td mat-cell *matCellDef="let c"><a [routerLink]="['/recalls', c.id]">{{ c.code }}</a></td>
      </ng-container>
      <ng-container matColumnDef="title">
        <th mat-header-cell *matHeaderCellDef>Title</th>
        <td mat-cell *matCellDef="let c">{{ c.title }}</td>
      </ng-container>
      <ng-container matColumnDef="progress">
        <th mat-header-cell *matHeaderCellDef>Progress</th>
        <td mat-cell *matCellDef="let c">{{ c.completed }} / {{ c.totalVehicles }} done · {{ c.outstanding }} outstanding</td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Status</th>
        <td mat-cell *matCellDef="let c"><mat-chip [class]="'status-' + c.status">{{ statusLabel(c.status) }}</mat-chip></td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>

    @if (!campaigns().length) {
      <p class="empty">No recall campaigns yet.</p>
    }
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .tiles {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .tile {
        flex: 1;
        min-width: 120px;
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .tile .num {
        font-size: 26px;
        font-weight: 600;
      }
      .tile.warn .num {
        color: var(--amx-warning-fg);
      }
      .tile.info .num {
        color: var(--amx-info-fg);
      }
      .tile.ok .num {
        color: var(--amx-success-fg);
      }
      .form-card {
        max-width: 560px;
        margin-bottom: 16px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .full-width {
        width: 100%;
      }
      table {
        width: 100%;
      }
      a {
        color: #0066b1;
        text-decoration: none;
      }
      .status-OPEN {
        background: var(--amx-info-bg);
      }
      .status-CLOSED {
        background: var(--amx-surface-sunken);
      }
      .empty {
        color: var(--amx-text-tertiary);
        margin-top: 16px;
      }
    `,
  ],
})
export class RecallsListComponent implements OnInit {
  readonly campaigns = signal<CampaignRow[]>([]);
  readonly summary = signal<RecallSummary | null>(null);
  readonly showForm = signal(false);
  readonly columns = ['code', 'title', 'progress', 'status'];

  form = { code: '', title: '', affectedModels: '', description: '' };

  private readonly http = inject(HttpClient);

  statusLabel(status: RecallCampaignStatus): string {
    return RECALL_CAMPAIGN_STATUS_LABELS[status];
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.http.get<CampaignRow[]>(`${environment.apiUrl}/recalls`).subscribe((data) => this.campaigns.set(data));
    this.http.get<RecallSummary>(`${environment.apiUrl}/recalls/summary`).subscribe((data) => this.summary.set(data));
  }

  create(): void {
    const body = {
      code: this.form.code,
      title: this.form.title,
      affectedModels: this.form.affectedModels || undefined,
      description: this.form.description || undefined,
    };
    this.http.post(`${environment.apiUrl}/recalls`, body).subscribe(() => {
      this.showForm.set(false);
      this.form = { code: '', title: '', affectedModels: '', description: '' };
      this.load();
    });
  }
}

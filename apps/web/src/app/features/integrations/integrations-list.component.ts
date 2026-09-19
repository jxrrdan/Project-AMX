import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { INTEGRATION_TARGET_ENTITY_LABELS, IntegrationTargetEntity, IntegrationType } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface Connector {
  id: string;
  name: string;
  type: IntegrationType;
  targetEntity: IntegrationTargetEntity;
  status: string;
  lastRunAt: string | null;
  lastError: string | null;
}

const TYPE_LABELS: Record<IntegrationType, string> = {
  REST_PULL: 'REST — poll (GET/POST)',
  REST_PUSH: 'REST — webhook (push)',
  MQTT: 'MQTT streaming',
};

@Component({
  selector: 'app-integrations-list',
  imports: [DatePipe, FormsModule, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <div class="header">
      <div>
        <h1>OEM Integration Hub</h1>
        <p class="subtitle">
          Connect a manufacturer or DMS feed without writing code — REST (poll or webhook) or MQTT
          streaming, mapped onto AMX fields and your own custom fields.
        </p>
      </div>
      <div class="header-actions">
        <button mat-stroked-button (click)="openScreenDesigner()">
          <mat-icon>dashboard_customize</mat-icon>
          Screen Designer
        </button>
        <button mat-flat-button color="primary" (click)="showForm.set(!showForm())">
          <mat-icon>add</mat-icon>
          New connector
        </button>
      </div>
    </div>

    @if (showForm()) {
      <mat-card class="form-card">
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Name</mat-label>
            <input matInput [(ngModel)]="form.name" placeholder="e.g. BMW RIS stock feed" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Type</mat-label>
            <mat-select [(ngModel)]="form.type">
              <mat-option value="REST_PULL">{{ typeLabels.REST_PULL }}</mat-option>
              <mat-option value="REST_PUSH">{{ typeLabels.REST_PUSH }}</mat-option>
              <mat-option value="MQTT">{{ typeLabels.MQTT }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Maps into</mat-label>
            <mat-select [(ngModel)]="form.targetEntity">
              @for (entity of targetEntities; track entity) {
                <mat-option [value]="entity">{{ entityLabels[entity] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <div class="row">
          <button mat-flat-button color="primary" [disabled]="!form.name || !form.type || !form.targetEntity" (click)="create()">
            Create &amp; configure
          </button>
          <button mat-button (click)="showForm.set(false)">Cancel</button>
        </div>
      </mat-card>
    }

    <div class="grid">
      @for (c of connectors(); track c.id) {
        <mat-card class="connector-card" (click)="open(c.id)">
          <div class="card-header">
            <span class="name">{{ c.name }}</span>
            <mat-chip [class]="'status-' + c.status.toLowerCase()">{{ c.status }}</mat-chip>
          </div>
          <div class="type">{{ typeLabels[c.type] }}</div>
          <div class="target">→ {{ entityLabels[c.targetEntity] }}</div>
          @if (c.lastRunAt) {
            <div class="last-run">Last run {{ c.lastRunAt | date: 'medium' }}</div>
          }
          @if (c.lastError) {
            <div class="last-error">{{ c.lastError }}</div>
          }
        </mat-card>
      }
      @if (!connectors().length) {
        <p class="empty">No connectors yet — create one to start mapping an OEM or DMS feed.</p>
      }
    </div>
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
        gap: 16px;
      }
      .header-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }
      .subtitle {
        color: rgba(0, 0, 0, 0.6);
        max-width: 640px;
        margin: 4px 0 0;
      }
      .form-card {
        max-width: 800px;
        padding: 16px;
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .row mat-form-field {
        flex: 1;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 16px;
      }
      .connector-card {
        padding: 16px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .connector-card:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .name {
        font-weight: 600;
      }
      .type {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
      }
      .target {
        font-size: 12px;
      }
      .last-run {
        font-size: 11px;
        color: rgba(0, 0, 0, 0.5);
        margin-top: 8px;
      }
      .last-error {
        font-size: 11px;
        color: #c62828;
      }
      .status-active {
        background: #c8e6c9;
      }
      .status-error {
        background: #ffcdd2;
      }
      .status-paused,
      .status-draft {
        background: #eeeeee;
      }
      .empty {
        color: rgba(0, 0, 0, 0.5);
      }
    `,
  ],
})
export class IntegrationsListComponent implements OnInit {
  readonly connectors = signal<Connector[]>([]);
  readonly showForm = signal(false);
  readonly typeLabels = TYPE_LABELS;
  readonly entityLabels = INTEGRATION_TARGET_ENTITY_LABELS;
  readonly targetEntities = Object.values(IntegrationTargetEntity);

  form = { name: '', type: '' as IntegrationType | '', targetEntity: '' as IntegrationTargetEntity | '' };

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.http.get<Connector[]>(`${environment.apiUrl}/integrations/connectors`).subscribe((data) => this.connectors.set(data));
  }

  create(): void {
    this.http.post<Connector>(`${environment.apiUrl}/integrations/connectors`, this.form).subscribe((created) => {
      this.showForm.set(false);
      this.form = { name: '', type: '', targetEntity: '' };
      this.router.navigate(['/integrations', created.id]);
    });
  }

  open(id: string): void {
    this.router.navigate(['/integrations', id]);
  }

  openScreenDesigner(): void {
    this.router.navigate(['/integrations/screens']);
  }
}

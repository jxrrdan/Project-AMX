import { HttpClient } from '@angular/common/http';
import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { IntegrationTargetEntity } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface ScreenField {
  field: string;
  label: string;
  isCustomField?: boolean;
}

/**
 * Renders whatever fields a business systems manager has laid out for this entity in the Screen
 * Designer (standard AMX fields and/or dealer-defined custom fields), fetching the record fresh
 * so it reflects the latest OEM/DMS integration data. Read-only — custom field values are written
 * by the integration ingest engine, not edited here.
 */
@Component({
  selector: 'app-custom-fields-panel',
  imports: [MatCardModule],
  template: `
    @if (fields().length) {
      <mat-card class="section">
        <h3>Additional fields</h3>
        <dl class="fields">
          @for (f of fields(); track f.field) {
            <dt>{{ f.label }}</dt>
            <dd>{{ value(f) }}</dd>
          }
        </dl>
      </mat-card>
    }
  `,
  styles: [
    `
      .section {
        padding: 16px;
        margin-bottom: 16px;
      }
      .fields {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 6px 16px;
        margin: 8px 0 0;
      }
      .fields dt {
        font-weight: 600;
        font-size: 13px;
      }
      .fields dd {
        margin: 0;
        font-size: 13px;
      }
    `,
  ],
})
export class CustomFieldsPanelComponent implements OnChanges {
  @Input({ required: true }) entity!: IntegrationTargetEntity;
  @Input() recordId?: string;

  readonly fields = signal<ScreenField[]>([]);
  readonly record = signal<Record<string, unknown> | null>(null);

  private readonly http = inject(HttpClient);

  ngOnChanges(): void {
    if (!this.entity || !this.recordId) {
      this.fields.set([]);
      this.record.set(null);
      return;
    }
    this.http
      .get<{ entity: IntegrationTargetEntity; fields: ScreenField[] }>(`${environment.apiUrl}/integrations/screens/${this.entity}`)
      .subscribe((screen) => {
        this.fields.set(screen.fields);
        if (screen.fields.length) {
          this.http
            .get<Record<string, unknown>>(`${environment.apiUrl}/integrations/records/${this.entity}/${this.recordId}`)
            .subscribe((record) => this.record.set(record));
        }
      });
  }

  value(field: ScreenField): string {
    const record = this.record();
    if (!record) return '—';
    const raw = field.isCustomField
      ? (record['customFields'] as Record<string, unknown> | undefined)?.[field.field]
      : record[field.field];
    if (raw === null || raw === undefined || raw === '') return '—';
    return String(raw);
  }
}

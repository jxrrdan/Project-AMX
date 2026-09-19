import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { INTEGRATION_TARGET_ENTITY_LABELS, IntegrationTargetEntity } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface AvailableField {
  field: string;
  label: string;
  isCustomField: boolean;
}

interface ScreenField {
  field: string;
  label: string;
  isCustomField: boolean;
}

interface TargetFieldOptions {
  columns: { field: string; label: string }[];
  customFields: { key: string; label: string; dataType: string }[];
}

@Component({
  selector: 'app-screen-designer',
  imports: [DragDropModule, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <h1>Screen Designer</h1>
    <p class="subtitle">
      Choose which fields — standard AMX fields and your own custom fields — appear on the record detail page for each
      entity, and in what order. Drag fields between the two lists, and drag within "On screen" to reorder.
    </p>

    <mat-form-field appearance="outline" class="entity-picker">
      <mat-label>Entity</mat-label>
      <mat-select [(ngModel)]="entity" (ngModelChange)="onEntityChange()">
        @for (e of entities; track e) {
          <mat-option [value]="e">{{ entityLabels[e] }}</mat-option>
        }
      </mat-select>
    </mat-form-field>

    <div class="columns" cdkDropListGroup>
      <mat-card class="column">
        <h3>Available fields</h3>
        <div
          class="list"
          cdkDropList
          id="available-list"
          [cdkDropListData]="available()"
          [cdkDropListConnectedTo]="['screen-list']"
          (cdkDropListDropped)="drop($event)"
        >
          @for (f of available(); track f.field) {
            <div class="field-pill" cdkDrag>
              {{ f.label }}
              @if (f.isCustomField) {
                <span class="badge">custom</span>
              }
            </div>
          }
          @if (!available().length) {
            <p class="empty">All fields are on the screen.</p>
          }
        </div>
      </mat-card>

      <mat-card class="column">
        <h3>On screen</h3>
        <div
          class="list"
          cdkDropList
          id="screen-list"
          [cdkDropListData]="screenFields()"
          [cdkDropListConnectedTo]="['available-list']"
          (cdkDropListDropped)="drop($event)"
        >
          @for (f of screenFields(); track f.field) {
            <div class="field-pill screen-pill" cdkDrag>
              <mat-icon class="drag-handle">drag_indicator</mat-icon>
              <input class="label-input" [(ngModel)]="f.label" placeholder="Display label" />
              @if (f.isCustomField) {
                <span class="badge">custom</span>
              }
              <button mat-icon-button (click)="removeField(f)"><mat-icon>close</mat-icon></button>
            </div>
          }
          @if (!screenFields().length) {
            <p class="empty">Drag fields here to show them on the {{ entityLabels[entity] }} detail page.</p>
          }
        </div>
      </mat-card>
    </div>

    <button mat-flat-button color="primary" (click)="save()">Save screen</button>

    @if (previewFields().length) {
      <mat-card class="section preview-card">
        <h3>Preview</h3>
        <p class="hint">Fetch a real record by id to see how the panel will render on its detail page.</p>
        <div class="row">
          <mat-form-field appearance="outline" class="grow">
            <mat-label>Record id</mat-label>
            <input matInput [(ngModel)]="previewRecordId" placeholder="paste a vehicle/part/contact/used-vehicle id" />
          </mat-form-field>
          <button mat-stroked-button (click)="loadPreview()">Preview</button>
        </div>
        @if (previewRecord(); as record) {
          <dl class="preview-fields">
            @for (f of previewFields(); track f.field) {
              <dt>{{ f.label }}</dt>
              <dd>{{ recordValue(record, f) }}</dd>
            }
          </dl>
        }
      </mat-card>
    }
  `,
  styles: [
    `
      .subtitle {
        color: rgba(0, 0, 0, 0.6);
        max-width: 720px;
      }
      .entity-picker {
        width: 260px;
        margin-bottom: 12px;
      }
      .columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 16px;
      }
      .column {
        padding: 12px;
      }
      .list {
        min-height: 200px;
        background: #eceff1;
        border-radius: 8px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .field-pill {
        background: #fff;
        border: 1px solid #90a4ae;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 13px;
        cursor: grab;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .screen-pill {
        cursor: default;
      }
      .drag-handle {
        cursor: grab;
        color: rgba(0, 0, 0, 0.4);
      }
      .label-input {
        flex: 1;
        border: none;
        border-bottom: 1px dashed #b0bec5;
        background: transparent;
        font-size: 13px;
        padding: 2px 4px;
      }
      .label-input:focus {
        outline: none;
        border-bottom-color: #1976d2;
      }
      .badge {
        font-size: 10px;
        color: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(0, 0, 0, 0.2);
        border-radius: 4px;
        padding: 0 4px;
      }
      .empty {
        color: rgba(0, 0, 0, 0.4);
        font-size: 13px;
      }
      .section {
        padding: 16px;
      }
      .preview-card {
        margin-top: 16px;
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .grow {
        flex: 1;
      }
      .hint {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.55);
      }
      .preview-fields {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 4px 16px;
        margin: 0;
      }
      .preview-fields dt {
        font-weight: 600;
        font-size: 13px;
      }
      .preview-fields dd {
        margin: 0;
        font-size: 13px;
      }
    `,
  ],
})
export class ScreenDesignerComponent implements OnInit {
  readonly entities = Object.values(IntegrationTargetEntity);
  readonly entityLabels = INTEGRATION_TARGET_ENTITY_LABELS;
  entity: IntegrationTargetEntity = IntegrationTargetEntity.VEHICLE;

  readonly available = signal<AvailableField[]>([]);
  readonly screenFields = signal<ScreenField[]>([]);
  readonly previewRecord = signal<Record<string, unknown> | null>(null);
  previewRecordId = '';

  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.load();
  }

  onEntityChange(): void {
    this.previewRecord.set(null);
    this.previewRecordId = '';
    this.load();
  }

  load(): void {
    this.http
      .get<TargetFieldOptions>(`${environment.apiUrl}/integrations/target-fields`, { params: { entity: this.entity } })
      .subscribe((options) => {
        this.http
          .get<{ entity: IntegrationTargetEntity; fields: ScreenField[] }>(
            `${environment.apiUrl}/integrations/screens/${this.entity}`,
          )
          .subscribe((screen) => {
            const allFields: AvailableField[] = [
              ...options.columns.map((c) => ({ field: c.field, label: c.label, isCustomField: false })),
              ...options.customFields.map((c) => ({ field: c.key, label: c.label, isCustomField: true })),
            ];
            const onScreen = screen.fields.map((f) => ({ ...f }));
            const onScreenKeys = new Set(onScreen.map((f) => f.field));
            this.screenFields.set(onScreen);
            this.available.set(allFields.filter((f) => !onScreenKeys.has(f.field)));
          });
      });
  }

  previewFields(): ScreenField[] {
    return this.screenFields();
  }

  drop(event: CdkDragDrop<AvailableField[] | ScreenField[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    this.available.set([...this.available()]);
    this.screenFields.set([...this.screenFields()]);
  }

  removeField(field: ScreenField): void {
    this.screenFields.update((fields) => fields.filter((f) => f !== field));
    this.available.update((fields) => [...fields, { field: field.field, label: field.label, isCustomField: field.isCustomField }]);
  }

  save(): void {
    const fields = this.screenFields().map((f) => ({ field: f.field, label: f.label, isCustomField: f.isCustomField }));
    this.http.post(`${environment.apiUrl}/integrations/screens/${this.entity}`, { fields }).subscribe({
      next: () => this.snackBar.open('Screen saved', 'Dismiss', { duration: 2000 }),
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not save screen', 'Dismiss', { duration: 4000 }),
    });
  }

  loadPreview(): void {
    if (!this.previewRecordId.trim()) return;
    this.http
      .get<Record<string, unknown>>(`${environment.apiUrl}/integrations/records/${this.entity}/${this.previewRecordId.trim()}`)
      .subscribe({
        next: (record) => this.previewRecord.set(record),
        error: (err) => {
          this.previewRecord.set(null);
          this.snackBar.open(err?.error?.message ?? 'Record not found', 'Dismiss', { duration: 3000 });
        },
      });
  }

  recordValue(record: Record<string, unknown>, field: ScreenField): string {
    const raw = field.isCustomField
      ? (record['customFields'] as Record<string, unknown> | undefined)?.[field.field]
      : record[field.field];
    if (raw === null || raw === undefined || raw === '') return '—';
    return String(raw);
  }
}

import { DatePipe, JsonPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import {
  CustomFieldDataType,
  INTEGRATION_TARGET_ENTITY_LABELS,
  IntegrationAuthType,
  IntegrationStatus,
  IntegrationTargetEntity,
  IntegrationTransform,
  IntegrationType,
} from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface FieldMapping {
  sourcePath: string;
  targetField: string;
  isCustomField: boolean;
  transform?: string | null;
}

interface Connector {
  id: string;
  name: string;
  type: IntegrationType;
  targetEntity: IntegrationTargetEntity;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  matchField: string | null;
  webhookToken: string;
  mappings: FieldMapping[];
  lastRunAt: string | null;
  lastError: string | null;
}

interface TargetFieldOptions {
  columns: { field: string; label: string }[];
  customFields: { key: string; label: string; dataType: string }[];
}

interface RunLog {
  id: string;
  status: string;
  recordsIn: number;
  recordsMapped: number;
  errorMessage: string | null;
  createdAt: string;
}

interface HeaderPairForm {
  key: string;
  value: string;
}

interface AuthForm {
  type: IntegrationAuthType | string;
  username?: string;
  password?: string;
  token?: string;
  headerName?: string;
  headerValue?: string;
}

interface ConnectionForm {
  url?: string;
  method?: 'GET' | 'POST';
  pollIntervalMinutes?: number;
  resultsPath?: string;
  brokerUrl?: string;
  topic?: string;
  username?: string;
  password?: string;
  headers?: HeaderPairForm[];
  auth?: AuthForm;
  requiredHeaderName?: string;
  requiredHeaderValue?: string;
}

@Component({
  selector: 'app-connector-detail',
  imports: [
    DatePipe,
    JsonPipe,
    DragDropModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
  ],
  template: `
    @if (connector(); as c) {
      <div class="header">
        <div>
          <button mat-icon-button (click)="back()"><mat-icon>arrow_back</mat-icon></button>
          <span class="name">{{ c.name }}</span>
          <mat-chip [class]="'status-' + c.status.toLowerCase()">{{ c.status }}</mat-chip>
        </div>
        <div class="actions">
          @if (c.status === 'ACTIVE') {
            <button mat-stroked-button (click)="setStatus('PAUSED')">Pause</button>
          } @else {
            <button mat-flat-button color="primary" (click)="setStatus('ACTIVE')">Activate</button>
          }
          <button mat-stroked-button color="warn" (click)="deleteConnector()">Delete</button>
        </div>
      </div>
      <p class="subtitle">{{ typeLabels[c.type] }} → {{ entityLabels[c.targetEntity] }}</p>

      <mat-card class="section">
        <h3>Connection</h3>
        @if (c.type === 'REST_PULL') {
          <div class="row">
            <mat-form-field appearance="outline" class="grow">
              <mat-label>Source URL</mat-label>
              <input matInput [(ngModel)]="connectionForm.url" placeholder="https://oem.example.com/api/vehicles" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Method</mat-label>
              <mat-select [(ngModel)]="connectionForm.method">
                <mat-option value="GET">GET</mat-option>
                <mat-option value="POST">POST</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Poll every (minutes)</mat-label>
              <input matInput type="number" [(ngModel)]="connectionForm.pollIntervalMinutes" />
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Results path (optional)</mat-label>
            <input matInput [(ngModel)]="connectionForm.resultsPath" placeholder="e.g. data.vehicles — leave blank if the response body is the array/record itself" />
          </mat-form-field>
          <p class="hint">
            No real OEM endpoint to poll here? Try
            <code>{{ apiUrl }}/integrations/_sample-oem-feed/vehicles</code>
            with results path <code>vehicles</code>.
          </p>

          <mat-divider />
          <h4>Authentication</h4>
          <mat-form-field appearance="outline">
            <mat-label>Auth type</mat-label>
            <mat-select [(ngModel)]="authForm.type">
              @for (t of authTypes; track t) {
                <mat-option [value]="t">{{ authTypeLabels[t] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @if (authForm.type === 'BASIC') {
            <div class="row">
              <mat-form-field appearance="outline">
                <mat-label>Username</mat-label>
                <input matInput [(ngModel)]="authForm.username" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Password</mat-label>
                <input matInput type="password" [(ngModel)]="authForm.password" [placeholder]="secretPlaceholder" />
              </mat-form-field>
            </div>
          }
          @if (authForm.type === 'BEARER') {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Bearer token</mat-label>
              <input matInput type="password" [(ngModel)]="authForm.token" [placeholder]="secretPlaceholder" />
            </mat-form-field>
          }
          @if (authForm.type === 'API_KEY') {
            <div class="row">
              <mat-form-field appearance="outline">
                <mat-label>Header name</mat-label>
                <input matInput [(ngModel)]="authForm.headerName" placeholder="X-API-Key" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Header value</mat-label>
                <input matInput type="password" [(ngModel)]="authForm.headerValue" [placeholder]="secretPlaceholder" />
              </mat-form-field>
            </div>
          }
          @if (authForm.type !== 'NONE') {
            <p class="hint">Leave a credential field blank when editing to keep the previously saved value.</p>
          }

          <h4>Custom headers</h4>
          @for (h of connectionForm.headers; track $index) {
            <div class="row">
              <mat-form-field appearance="outline">
                <mat-label>Header name</mat-label>
                <input matInput [(ngModel)]="h.key" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="grow">
                <mat-label>Value</mat-label>
                <input matInput [(ngModel)]="h.value" />
              </mat-form-field>
              <button mat-icon-button (click)="removeHeader($index)"><mat-icon>close</mat-icon></button>
            </div>
          }
          <button mat-stroked-button (click)="addHeader()">+ Add header</button>
        }
        @if (c.type === 'REST_PUSH') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Inbound webhook URL</mat-label>
            <input matInput readonly [value]="webhookUrl(c)" />
          </mat-form-field>
          <div class="row">
            <button mat-stroked-button (click)="copyWebhookUrl(c)">Copy URL</button>
            <button mat-stroked-button (click)="regenerateToken()">Regenerate (revoke old URL)</button>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Results path (optional)</mat-label>
            <input matInput [(ngModel)]="connectionForm.resultsPath" placeholder="e.g. records — leave blank if the posted body is the array/record itself" />
          </mat-form-field>

          <mat-divider />
          <h4>Shared secret (optional, defence in depth on top of the token in the URL)</h4>
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Required header name</mat-label>
              <input matInput [(ngModel)]="connectionForm.requiredHeaderName" placeholder="X-Shared-Secret" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Required header value</mat-label>
              <input matInput type="password" [(ngModel)]="connectionForm.requiredHeaderValue" [placeholder]="secretPlaceholder" />
            </mat-form-field>
          </div>
          <p class="hint">If set, the sender must include this header with this exact value or the webhook is rejected. Leave the value blank when editing to keep it unchanged.</p>
        }
        @if (c.type === 'MQTT') {
          <div class="row">
            <mat-form-field appearance="outline" class="grow">
              <mat-label>Broker URL</mat-label>
              <input matInput [(ngModel)]="connectionForm.brokerUrl" placeholder="mqtt://broker.oem.example.com:1883" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="grow">
              <mat-label>Topic</mat-label>
              <input matInput [(ngModel)]="connectionForm.topic" placeholder="oem/dealer/123/vehicles" />
            </mat-form-field>
          </div>
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Username (optional)</mat-label>
              <input matInput [(ngModel)]="connectionForm.username" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Password (optional)</mat-label>
              <input matInput type="password" [(ngModel)]="connectionForm.password" />
            </mat-form-field>
          </div>
          <p class="hint">No broker to hand? Verify your mapping with "Send test data" below instead of a live subscription.</p>
        }
        <mat-form-field appearance="outline">
          <mat-label>Match on (create vs. update)</mat-label>
          <mat-select [(ngModel)]="matchFieldForm">
            <mat-option [value]="null">Always create a new record</mat-option>
            @for (col of targetOptions()?.columns; track col.field) {
              <mat-option [value]="col.field">{{ col.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div class="row">
          <button mat-flat-button color="primary" (click)="saveConnection()">Save connection settings</button>
        </div>
      </mat-card>

      <mat-card class="section">
        <h3>Field mapping</h3>
        <p class="hint">Paste a sample record (or array of records) from the feed to discover its fields, then drag each one onto the AMX field it should fill.</p>
        <div class="row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Sample payload (JSON)</mat-label>
            <textarea matInput rows="4" [(ngModel)]="samplePayloadText" placeholder='{"vin": "WBA123", "model": "BMW X1", "oemCode": "GB-045"}'></textarea>
          </mat-form-field>
        </div>
        <button mat-stroked-button (click)="discoverFields()">Discover fields</button>

        <div class="mapper" cdkDropListGroup>
          <div class="source-panel">
            <h4>Source fields</h4>
            <div class="source-list" cdkDropList id="source-list" [cdkDropListData]="sourceFields()" cdkDropListSortingDisabled>
              @for (field of sourceFields(); track field) {
                <div class="source-pill" cdkDrag [cdkDragData]="field">{{ field }}</div>
              }
              @if (!sourceFields().length) {
                <p class="empty">Discover fields from a sample payload, or add one manually below.</p>
              }
            </div>
            <div class="row">
              <mat-form-field appearance="outline" class="grow">
                <mat-label>Add source field manually</mat-label>
                <input matInput [(ngModel)]="manualSourceField" (keyup.enter)="addManualSourceField()" placeholder="e.g. items[0].partNumber" />
              </mat-form-field>
              <button mat-icon-button (click)="addManualSourceField()"><mat-icon>add</mat-icon></button>
            </div>
          </div>

          <div class="target-panel">
            <h4>{{ entityLabels[c.targetEntity] }} fields</h4>
            @for (col of targetOptions()?.columns; track col.field) {
              <div class="target-row">
                <span class="target-label">{{ col.label }}</span>
                <div
                  class="drop-zone"
                  cdkDropList
                  [id]="'target-' + col.field"
                  [cdkDropListData]="emptyDropData"
                  (cdkDropListDropped)="onDrop($event, col.field, false)"
                >
                  @if (mappingFor(col.field, false); as m) {
                    <div class="mapped-pill">
                      <span>{{ m.sourcePath }}</span>
                      <select [ngModel]="m.transform" (ngModelChange)="setTransform(m, $event)">
                        <option [value]="null">No transform</option>
                        @for (t of transforms; track t) {
                          <option [value]="t">{{ t }}</option>
                        }
                      </select>
                      <button mat-icon-button (click)="removeMapping(m)"><mat-icon>close</mat-icon></button>
                    </div>
                  } @else {
                    <span class="placeholder">Drop a source field here</span>
                  }
                </div>
              </div>
            }

            <mat-divider />
            <h4>Custom fields</h4>
            @for (cf of targetOptions()?.customFields; track cf.key) {
              <div class="target-row">
                <span class="target-label">{{ cf.label }} <span class="type-badge">{{ cf.dataType }}</span></span>
                <div
                  class="drop-zone"
                  cdkDropList
                  [id]="'target-custom-' + cf.key"
                  [cdkDropListData]="emptyDropData"
                  (cdkDropListDropped)="onDrop($event, cf.key, true)"
                >
                  @if (mappingFor(cf.key, true); as m) {
                    <div class="mapped-pill">
                      <span>{{ m.sourcePath }}</span>
                      <button mat-icon-button (click)="removeMapping(m)"><mat-icon>close</mat-icon></button>
                    </div>
                  } @else {
                    <span class="placeholder">Drop a source field here</span>
                  }
                </div>
              </div>
            }

            <div class="add-custom-field">
              <mat-form-field appearance="outline">
                <mat-label>Key</mat-label>
                <input matInput [(ngModel)]="customFieldForm.key" placeholder="oemDealerNetCode" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Label</mat-label>
                <input matInput [(ngModel)]="customFieldForm.label" placeholder="OEM Dealer Net Code" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Type</mat-label>
                <mat-select [(ngModel)]="customFieldForm.dataType">
                  @for (t of dataTypes; track t) {
                    <mat-option [value]="t">{{ t }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <button mat-stroked-button [disabled]="!customFieldForm.key || !customFieldForm.label" (click)="addCustomField()">
                + Add custom field
              </button>
            </div>
          </div>
        </div>

        <button mat-flat-button color="primary" [disabled]="!mappings().length" (click)="saveMappings()">Save mappings</button>
      </mat-card>

      <mat-card class="section">
        <h3>Send test data</h3>
        <p class="hint">Runs a payload through the saved mapping for real — it will create or update an actual record, same as a live event.</p>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Test payload (JSON)</mat-label>
          <textarea matInput rows="4" [(ngModel)]="testPayloadText"></textarea>
        </mat-form-field>
        <button mat-stroked-button (click)="sendTestPayload()">Send test data</button>
        @if (testResult(); as result) {
          <pre class="test-result">{{ result | json }}</pre>
        }
      </mat-card>

      <mat-card class="section">
        <h3>Recent runs</h3>
        <table mat-table [dataSource]="runLogs()" class="mat-elevation-z0">
          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef>When</th>
            <td mat-cell *matCellDef="let log">{{ log.createdAt | date: 'medium' }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let log"><mat-chip [class]="'status-' + log.status.toLowerCase()">{{ log.status }}</mat-chip></td>
          </ng-container>
          <ng-container matColumnDef="records">
            <th mat-header-cell *matHeaderCellDef>Records</th>
            <td mat-cell *matCellDef="let log">{{ log.recordsMapped }} / {{ log.recordsIn }}</td>
          </ng-container>
          <ng-container matColumnDef="error">
            <th mat-header-cell *matHeaderCellDef>Error</th>
            <td mat-cell *matCellDef="let log">{{ log.errorMessage }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="runLogColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: runLogColumns"></tr>
        </table>
        @if (!runLogs().length) {
          <p class="empty">No runs yet.</p>
        }
      </mat-card>
    }
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .header > div:first-child {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .name {
        font-size: 20px;
        font-weight: 600;
      }
      .subtitle {
        color: rgba(0, 0, 0, 0.6);
        margin: 0 0 16px 40px;
      }
      .actions {
        display: flex;
        gap: 8px;
      }
      .section {
        padding: 16px;
        margin-bottom: 16px;
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 8px;
      }
      .row mat-form-field {
        flex: 1;
      }
      .grow {
        flex: 2;
      }
      .full-width {
        width: 100%;
      }
      .hint {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.55);
      }
      .mapper {
        display: grid;
        grid-template-columns: 1fr 1.4fr;
        gap: 16px;
        margin: 12px 0;
      }
      .source-list {
        min-height: 100px;
        background: #eceff1;
        border-radius: 8px;
        padding: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 8px;
      }
      .source-pill {
        background: #fff;
        border: 1px solid #90a4ae;
        border-radius: 16px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: grab;
      }
      .target-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }
      .target-label {
        width: 180px;
        font-size: 13px;
        flex-shrink: 0;
      }
      .type-badge {
        font-size: 10px;
        color: rgba(0, 0, 0, 0.5);
      }
      .drop-zone {
        flex: 1;
        min-height: 36px;
        border: 1px dashed #b0bec5;
        border-radius: 6px;
        display: flex;
        align-items: center;
        padding: 4px 8px;
      }
      .placeholder {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.4);
      }
      .mapped-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #e3f2fd;
        border-radius: 14px;
        padding: 2px 8px;
        font-size: 12px;
        width: 100%;
      }
      .mapped-pill select {
        font-size: 11px;
      }
      .add-custom-field {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        margin-top: 12px;
      }
      .test-result {
        background: #eceff1;
        padding: 12px;
        border-radius: 6px;
        font-size: 12px;
        overflow-x: auto;
      }
      table {
        width: 100%;
      }
      .empty {
        color: rgba(0, 0, 0, 0.5);
        font-size: 13px;
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
      .status-success {
        background: #c8e6c9;
      }
    `,
  ],
})
export class ConnectorDetailComponent implements OnInit {
  readonly connector = signal<Connector | null>(null);
  readonly targetOptions = signal<TargetFieldOptions | null>(null);
  readonly runLogs = signal<RunLog[]>([]);
  readonly sourceFields = signal<string[]>([]);
  readonly mappings = signal<FieldMapping[]>([]);
  readonly testResult = signal<unknown>(null);

  readonly typeLabels: Record<IntegrationType, string> = {
    REST_PULL: 'REST — poll (GET/POST)',
    REST_PUSH: 'REST — webhook (push)',
    MQTT: 'MQTT streaming',
  };
  readonly entityLabels = INTEGRATION_TARGET_ENTITY_LABELS;
  readonly transforms = Object.values(IntegrationTransform);
  readonly dataTypes = Object.values(CustomFieldDataType);
  readonly apiUrl = environment.apiUrl;
  readonly runLogColumns = ['createdAt', 'status', 'records', 'error'];
  readonly authTypes = Object.values(IntegrationAuthType);
  readonly authTypeLabels: Record<string, string> = {
    NONE: 'None',
    BASIC: 'Basic (username/password)',
    BEARER: 'Bearer token',
    API_KEY: 'API key header',
  };
  readonly secretPlaceholder = '(unchanged — leave blank to keep the saved value)';
  /** Must match rest-auth.util's redaction placeholder on the API. */
  private readonly secretRedactedValue = '••••••••';

  connectionForm: ConnectionForm = {};
  authForm: AuthForm = { type: IntegrationAuthType.NONE };
  readonly emptyDropData: unknown[] = [];
  matchFieldForm: string | null = null;
  samplePayloadText = '';
  manualSourceField = '';
  testPayloadText = '';
  customFieldForm = { key: '', label: '', dataType: CustomFieldDataType.STRING as string };

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private connectorId = '';

  ngOnInit(): void {
    this.connectorId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
    this.loadRunLogs();
  }

  load(): void {
    this.http.get<Connector>(`${environment.apiUrl}/integrations/connectors/${this.connectorId}`).subscribe((data) => {
      this.connector.set(data);
      this.connectionForm = this.unredact({
        ...data.config,
        headers: ((data.config['headers'] as HeaderPairForm[]) ?? []).map((h) => ({ ...h })),
      });
      this.authForm = this.unredact({ type: IntegrationAuthType.NONE, ...(data.config['auth'] as AuthForm | undefined) });
      this.matchFieldForm = data.matchField;
      this.mappings.set(data.mappings.map((m) => ({ ...m })));
      this.loadTargetOptions(data.targetEntity);
    });
  }

  /**
   * The API never sends a real saved secret back — it sends the redaction placeholder instead
   * (see rest-auth.util's redactConfigSecrets). Blank those out here rather than loading the
   * placeholder text into an editable field: otherwise resaving without retyping the secret would
   * submit the literal placeholder string and overwrite the real value with it.
   */
  private unredact<T extends Record<string, unknown>>(form: T): T {
    const result: Record<string, unknown> = { ...form };
    for (const key of ['password', 'token', 'headerValue', 'requiredHeaderValue']) {
      if (result[key] === this.secretRedactedValue) {
        result[key] = '';
      }
    }
    if (Array.isArray(result['headers'])) {
      result['headers'] = (result['headers'] as HeaderPairForm[]).map((h) =>
        h.value === this.secretRedactedValue ? { ...h, value: '' } : h,
      );
    }
    return result as T;
  }

  addHeader(): void {
    this.connectionForm.headers = [...(this.connectionForm.headers ?? []), { key: '', value: '' }];
  }

  removeHeader(index: number): void {
    this.connectionForm.headers = (this.connectionForm.headers ?? []).filter((_, i) => i !== index);
  }

  loadTargetOptions(entity: IntegrationTargetEntity): void {
    this.http
      .get<TargetFieldOptions>(`${environment.apiUrl}/integrations/target-fields`, { params: { entity } })
      .subscribe((data) => this.targetOptions.set(data));
  }

  loadRunLogs(): void {
    this.http
      .get<RunLog[]>(`${environment.apiUrl}/integrations/connectors/${this.connectorId}/run-logs`)
      .subscribe((data) => this.runLogs.set(data));
  }

  back(): void {
    this.router.navigate(['/integrations']);
  }

  webhookUrl(c: Connector): string {
    return `${environment.apiUrl}/integrations/webhooks/${c.webhookToken}`;
  }

  copyWebhookUrl(c: Connector): void {
    navigator.clipboard?.writeText(this.webhookUrl(c));
    this.snackBar.open('Webhook URL copied', 'Dismiss', { duration: 2000 });
  }

  regenerateToken(): void {
    this.http
      .post<Connector>(`${environment.apiUrl}/integrations/connectors/${this.connectorId}/regenerate-webhook-token`, {})
      .subscribe(() => {
        this.snackBar.open('Webhook URL regenerated — the old one no longer works', 'Dismiss', { duration: 3000 });
        this.load();
      });
  }

  setStatus(status: string): void {
    this.http
      .patch<Connector>(`${environment.apiUrl}/integrations/connectors/${this.connectorId}`, { status })
      .subscribe(() => this.load());
  }

  saveConnection(): void {
    const config: ConnectionForm = {
      ...this.connectionForm,
      headers: (this.connectionForm.headers ?? []).filter((h) => h.key),
      auth: this.authForm,
    };
    this.http
      .patch<Connector>(`${environment.apiUrl}/integrations/connectors/${this.connectorId}`, {
        config,
        matchField: this.matchFieldForm,
      })
      .subscribe(() => {
        this.snackBar.open('Connection settings saved', 'Dismiss', { duration: 2000 });
        this.load();
      });
  }

  deleteConnector(): void {
    this.http.delete(`${environment.apiUrl}/integrations/connectors/${this.connectorId}`).subscribe(() => this.back());
  }

  discoverFields(): void {
    try {
      const parsed = JSON.parse(this.samplePayloadText);
      const sample = Array.isArray(parsed) ? parsed[0] : parsed;
      this.sourceFields.set(this.flatten(sample));
    } catch {
      this.snackBar.open('That is not valid JSON', 'Dismiss', { duration: 3000 });
    }
  }

  private flatten(value: unknown, prefix = ''): string[] {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) {
      return value.length ? this.flatten(value[0], `${prefix}[0]`) : [];
    }
    if (typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).flatMap(([key, v]) =>
        this.flatten(v, prefix ? `${prefix}.${key}` : key),
      );
    }
    return [prefix];
  }

  addManualSourceField(): void {
    const field = this.manualSourceField.trim();
    if (!field) return;
    if (!this.sourceFields().includes(field)) {
      this.sourceFields.update((fields) => [...fields, field]);
    }
    this.manualSourceField = '';
  }

  mappingFor(targetField: string, isCustomField: boolean): FieldMapping | undefined {
    return this.mappings().find((m) => m.targetField === targetField && m.isCustomField === isCustomField);
  }

  onDrop(event: CdkDragDrop<unknown[]>, targetField: string, isCustomField: boolean): void {
    const sourcePath = event.item.data as string;
    this.mappings.update((mappings) => [
      ...mappings.filter((m) => !(m.targetField === targetField && m.isCustomField === isCustomField)),
      { sourcePath, targetField, isCustomField, transform: null },
    ]);
  }

  setTransform(mapping: FieldMapping, transform: string): void {
    this.mappings.update((mappings) =>
      mappings.map((m) => (m === mapping ? { ...m, transform: transform || null } : m)),
    );
  }

  removeMapping(mapping: FieldMapping): void {
    this.mappings.update((mappings) => mappings.filter((m) => m !== mapping));
  }

  saveMappings(): void {
    this.http
      .post(`${environment.apiUrl}/integrations/connectors/${this.connectorId}/mappings`, { mappings: this.mappings() })
      .subscribe({
        next: () => this.snackBar.open('Mappings saved', 'Dismiss', { duration: 2000 }),
        error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not save mappings', 'Dismiss', { duration: 4000 }),
      });
  }

  addCustomField(): void {
    const connector = this.connector();
    if (!connector) return;
    this.http
      .post(`${environment.apiUrl}/integrations/custom-fields`, { ...this.customFieldForm, entity: connector.targetEntity })
      .subscribe({
        next: () => {
          this.customFieldForm = { key: '', label: '', dataType: CustomFieldDataType.STRING };
          this.loadTargetOptions(connector.targetEntity);
        },
        error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not add custom field', 'Dismiss', { duration: 4000 }),
      });
  }

  sendTestPayload(): void {
    try {
      const payload = JSON.parse(this.testPayloadText);
      this.http
        .post(`${environment.apiUrl}/integrations/connectors/${this.connectorId}/test`, { payload })
        .subscribe({
          next: (result) => {
            this.testResult.set(result);
            this.loadRunLogs();
          },
          error: (err) => this.testResult.set({ error: err?.error?.message ?? 'Test failed' }),
        });
    } catch {
      this.snackBar.open('That is not valid JSON', 'Dismiss', { duration: 3000 });
    }
  }
}

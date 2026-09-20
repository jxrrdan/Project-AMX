import { JsonPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ACTION_TRIGGER_POINT_LABELS,
  ActionTriggerPoint,
  ConfigScope,
  CONFIG_SCOPE_LABELS,
  INTEGRATION_TARGET_ENTITY_LABELS,
  IntegrationTargetEntity,
  IntegrationTransform,
} from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface HeaderPairForm {
  key: string;
  value: string;
}

interface FieldMapping {
  sourcePath: string;
  targetField: string;
  isCustomField: boolean;
  transform?: string | null;
}

@Component({
  selector: 'app-action-trigger-editor',
  imports: [
    JsonPipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  template: `
    <div class="header">
      <div>
        <button mat-icon-button (click)="back()"><mat-icon>arrow_back</mat-icon></button>
        <span class="title">{{ isNew ? 'New' : 'Edit' }} action trigger</span>
      </div>
      <div class="actions">
        @if (!isNew) {
          <button mat-stroked-button color="warn" (click)="deleteTrigger()">Delete</button>
        }
        <button mat-flat-button color="primary" (click)="save()">Save</button>
      </div>
    </div>

    <mat-card class="section">
      <div class="row">
        <mat-form-field appearance="outline" class="grow">
          <mat-label>Name</mat-label>
          <input matInput [(ngModel)]="name" placeholder="e.g. OEM registration lookup" />
        </mat-form-field>
        @if (!isNew) {
          <mat-slide-toggle [(ngModel)]="active">Active</mat-slide-toggle>
        }
      </div>

      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>Fires on</mat-label>
          <mat-select [(ngModel)]="triggerPoint" [disabled]="!isNew">
            @for (p of triggerPoints; track p) {
              <mat-option [value]="p">{{ triggerPointLabels[p] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Maps into</mat-label>
          <mat-select [(ngModel)]="targetEntity" [disabled]="!isNew">
            @for (e of targetEntities; track e) {
              <mat-option [value]="e">{{ entityLabels[e] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (isNew) {
          <mat-form-field appearance="outline">
            <mat-label>Scope</mat-label>
            <mat-select [(ngModel)]="scope">
              @for (s of scopes; track s) {
                <mat-option [value]="s">{{ scopeLabels[s] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
      </div>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>URL template</mat-label>
        <input matInput [(ngModel)]="urlTemplate" placeholder="https://oem.example.com/vehicles/{value}" />
      </mat-form-field>
      <p class="hint">
        <code>{{ '{value}' }}</code> is replaced with whatever the user searched for (e.g. the registration).
      </p>

      <h4>Authentication</h4>
      <mat-form-field appearance="outline">
        <mat-label>Auth type</mat-label>
        <mat-select [(ngModel)]="authType">
          <mat-option value="NONE">None</mat-option>
          <mat-option value="BASIC">Basic (username/password)</mat-option>
          <mat-option value="BEARER">Bearer token</mat-option>
          <mat-option value="API_KEY">API key header</mat-option>
        </mat-select>
      </mat-form-field>
      @if (authType === 'BASIC') {
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Username</mat-label>
            <input matInput [(ngModel)]="authUsername" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Password</mat-label>
            <input matInput type="password" [(ngModel)]="authPassword" [placeholder]="secretPlaceholder" />
          </mat-form-field>
        </div>
      }
      @if (authType === 'BEARER') {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Bearer token</mat-label>
          <input matInput type="password" [(ngModel)]="authToken" [placeholder]="secretPlaceholder" />
        </mat-form-field>
      }
      @if (authType === 'API_KEY') {
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Header name</mat-label>
            <input matInput [(ngModel)]="authHeaderName" placeholder="X-API-Key" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Header value</mat-label>
            <input matInput type="password" [(ngModel)]="authHeaderValue" [placeholder]="secretPlaceholder" />
          </mat-form-field>
        </div>
      }

      <h4>Custom headers</h4>
      @for (h of headers; track $index) {
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
    </mat-card>

    @if (!isNew) {
      <mat-card class="section">
        <h3>Field mapping</h3>
        <p class="hint">Map fields from the API's JSON response onto AMX fields — dot paths, e.g. <code>data.colour</code>.</p>
        @for (m of mappings(); track $index) {
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Source path</mat-label>
              <input matInput [(ngModel)]="m.sourcePath" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Target field</mat-label>
              <input matInput [(ngModel)]="m.targetField" placeholder="e.g. colour" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Transform</mat-label>
              <mat-select [ngModel]="m.transform" (ngModelChange)="m.transform = $event">
                <mat-option [value]="null">None</mat-option>
                @for (t of transforms; track t) {
                  <mat-option [value]="t">{{ t }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <button mat-icon-button (click)="removeMapping($index)"><mat-icon>close</mat-icon></button>
          </div>
        }
        <button mat-stroked-button (click)="addMapping()">+ Add field mapping</button>
        <div class="row">
          <button mat-flat-button color="primary" (click)="saveMappings()">Save mappings</button>
        </div>
      </mat-card>

      <mat-card class="section">
        <h3>Test</h3>
        <div class="row">
          <mat-form-field appearance="outline" class="grow">
            <mat-label>Sample search value</mat-label>
            <input matInput [(ngModel)]="testValue" placeholder="e.g. AB12CDE" />
          </mat-form-field>
          <button mat-stroked-button (click)="test()">Run test</button>
        </div>
        @if (testResult(); as result) {
          <pre class="test-result">{{ result | json }}</pre>
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
        margin-bottom: 12px;
      }
      .header > div:first-child {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .title {
        font-size: 18px;
        font-weight: 600;
      }
      .actions {
        display: flex;
        gap: 8px;
      }
      .section {
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
      .test-result {
        background: #eceff1;
        padding: 12px;
        border-radius: 6px;
        font-size: 12px;
        overflow-x: auto;
      }
    `,
  ],
})
export class ActionTriggerEditorComponent implements OnInit {
  readonly triggerPoints = Object.values(ActionTriggerPoint);
  readonly triggerPointLabels = ACTION_TRIGGER_POINT_LABELS;
  readonly targetEntities = Object.values(IntegrationTargetEntity);
  readonly entityLabels = INTEGRATION_TARGET_ENTITY_LABELS;
  readonly scopes = Object.values(ConfigScope);
  readonly scopeLabels = CONFIG_SCOPE_LABELS;
  readonly transforms = Object.values(IntegrationTransform);
  readonly secretPlaceholder = '(unchanged — leave blank to keep the saved value)';
  private readonly secretRedactedValue = '••••••••';

  readonly mappings = signal<FieldMapping[]>([]);
  readonly testResult = signal<unknown>(null);

  isNew = true;
  name = '';
  triggerPoint: ActionTriggerPoint = ActionTriggerPoint.USED_VEHICLE_REG_LOOKUP;
  targetEntity: IntegrationTargetEntity = IntegrationTargetEntity.USED_VEHICLE;
  scope: ConfigScope = ConfigScope.DEALER;
  active = true;
  urlTemplate = '';
  authType = 'NONE';
  authUsername = '';
  authPassword = '';
  authToken = '';
  authHeaderName = '';
  authHeaderValue = '';
  headers: HeaderPairForm[] = [];
  testValue = '';

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private triggerId = '';

  ngOnInit(): void {
    this.triggerId = this.route.snapshot.paramMap.get('id') ?? 'new';
    this.isNew = this.triggerId === 'new';
    if (!this.isNew) {
      this.load();
    }
  }

  private unredact(value: string): string {
    return value === this.secretRedactedValue ? '' : value;
  }

  load(): void {
    this.http
      .get<{
        name: string;
        triggerPoint: ActionTriggerPoint;
        targetEntity: IntegrationTargetEntity;
        active: boolean;
        config: Record<string, unknown>;
        mappings: FieldMapping[];
      }>(`${environment.apiUrl}/action-triggers/${this.triggerId}`)
      .subscribe((trigger) => {
        this.name = trigger.name;
        this.triggerPoint = trigger.triggerPoint;
        this.targetEntity = trigger.targetEntity;
        this.active = trigger.active;
        this.mappings.set(trigger.mappings.map((m) => ({ ...m })));

        const config = trigger.config as {
          urlTemplate?: string;
          headers?: HeaderPairForm[];
          auth?: { type?: string; username?: string; password?: string; token?: string; headerName?: string; headerValue?: string };
        };
        this.urlTemplate = config.urlTemplate ?? '';
        this.headers = (config.headers ?? []).map((h) => ({ key: h.key, value: this.unredact(h.value) }));
        this.authType = config.auth?.type ?? 'NONE';
        this.authUsername = config.auth?.username ?? '';
        this.authPassword = this.unredact(config.auth?.password ?? '');
        this.authToken = this.unredact(config.auth?.token ?? '');
        this.authHeaderName = config.auth?.headerName ?? '';
        this.authHeaderValue = this.unredact(config.auth?.headerValue ?? '');
      });
  }

  private buildConfig() {
    return {
      urlTemplate: this.urlTemplate,
      headers: this.headers.filter((h) => h.key),
      auth: {
        type: this.authType,
        username: this.authUsername,
        password: this.authPassword,
        token: this.authToken,
        headerName: this.authHeaderName,
        headerValue: this.authHeaderValue,
      },
    };
  }

  save(): void {
    if (!this.name.trim()) {
      this.snackBar.open('Give the trigger a name first', 'Dismiss', { duration: 3000 });
      return;
    }
    const request = this.isNew
      ? this.http.post(`${environment.apiUrl}/action-triggers`, {
          name: this.name,
          triggerPoint: this.triggerPoint,
          targetEntity: this.targetEntity,
          scope: this.scope,
          config: this.buildConfig(),
        })
      : this.http.patch(`${environment.apiUrl}/action-triggers/${this.triggerId}`, {
          name: this.name,
          active: this.active,
          config: this.buildConfig(),
        });

    request.subscribe({
      next: () => {
        this.snackBar.open('Action trigger saved', 'Dismiss', { duration: 2000 });
        this.back();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not save action trigger', 'Dismiss', { duration: 4000 }),
    });
  }

  addHeader(): void {
    this.headers = [...this.headers, { key: '', value: '' }];
  }

  removeHeader(index: number): void {
    this.headers = this.headers.filter((_, i) => i !== index);
  }

  addMapping(): void {
    this.mappings.update((mappings) => [...mappings, { sourcePath: '', targetField: '', isCustomField: false, transform: null }]);
  }

  removeMapping(index: number): void {
    this.mappings.update((mappings) => mappings.filter((_, i) => i !== index));
  }

  saveMappings(): void {
    this.http
      .post(`${environment.apiUrl}/action-triggers/${this.triggerId}/mappings`, { mappings: this.mappings() })
      .subscribe({
        next: () => this.snackBar.open('Mappings saved', 'Dismiss', { duration: 2000 }),
        error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not save mappings', 'Dismiss', { duration: 4000 }),
      });
  }

  test(): void {
    if (!this.testValue.trim()) return;
    this.http.post(`${environment.apiUrl}/action-triggers/${this.triggerId}/test`, { value: this.testValue }).subscribe({
      next: (result) => this.testResult.set(result),
      error: (err) => this.testResult.set({ error: err?.error?.message ?? 'Test failed' }),
    });
  }

  deleteTrigger(): void {
    this.http.delete(`${environment.apiUrl}/action-triggers/${this.triggerId}`).subscribe(() => this.back());
  }

  back(): void {
    this.router.navigate(['/admin/settings']);
  }
}

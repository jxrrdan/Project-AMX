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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import {
  ACTION_TRIGGER_POINT_LABELS,
  ActionTriggerPoint,
  BATCH_JOB_DEFINITIONS,
  BatchJobName,
  DOCUMENT_TEMPLATE_TYPE_LABELS,
  DocumentTemplateType,
} from '@project-amx/shared';
import { ThemeService } from '../../core/theme.service';
import { environment } from '../../../environments/environment';

interface DealerProfile {
  id: string;
  name: string;
  address: string | null;
  franchiseCode: string | null;
  vatNumber: string | null;
  invoiceFooterNote: string | null;
  timeZone: string;
  locale: string;
  logoUrl: string | null;
  primaryColour: string | null;
  secondaryColour: string | null;
  labourRatePerHour: number | null;
  franchise: Franchise | null;
}

interface DocumentSequence {
  id: string;
  docType: string;
  prefix: string;
  year: number;
  nextNumber: number;
}

interface BatchJobRun {
  id: string;
  jobName: string;
  status: string;
  summary: string | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface DocumentTemplateSummary {
  id: string;
  type: DocumentTemplateType;
  name: string;
  isDefault: boolean;
  updatedAt: string;
}

interface Group {
  id: string;
  name: string;
}

interface Franchise {
  id: string;
  name: string;
  group: Group | null;
}

interface ActionTriggerSummary {
  id: string;
  name: string;
  triggerPoint: ActionTriggerPoint;
  active: boolean;
  scope: string;
}

@Component({
  selector: 'app-settings',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTableModule,
    MatTabsModule,
  ],
  template: `
    <h1>Settings</h1>
    <mat-tab-group>
      <mat-tab label="Dealer profile">
        <mat-card class="section">
          <div class="row">
            <mat-form-field appearance="outline" class="grow">
              <mat-label>Dealer name</mat-label>
              <input matInput [(ngModel)]="profileForm.name" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Franchise code</mat-label>
              <input matInput [(ngModel)]="profileForm.franchiseCode" />
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Address</mat-label>
            <textarea matInput rows="2" [(ngModel)]="profileForm.address"></textarea>
          </mat-form-field>
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>VAT number</mat-label>
              <input matInput [(ngModel)]="profileForm.vatNumber" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Time zone</mat-label>
              <input matInput [(ngModel)]="profileForm.timeZone" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Locale</mat-label>
              <input matInput [(ngModel)]="profileForm.locale" />
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Invoice footer note</mat-label>
            <textarea matInput rows="2" [(ngModel)]="profileForm.invoiceFooterNote" placeholder="e.g. company registration details, terms & conditions link"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Labour rate (£/hour, for aftersales invoices)</mat-label>
            <input matInput type="number" [(ngModel)]="profileForm.labourRatePerHour" />
          </mat-form-field>
          <button mat-flat-button color="primary" (click)="saveProfile()">Save profile</button>
        </mat-card>
      </mat-tab>

      <mat-tab label="Organisation">
        <mat-card class="section">
          <p class="hint">
            Join a franchise (e.g. "BMW") to share document templates, branding, and action
            triggers with every other outlet in it — and, transitively, with its dealer group. This
            outlet's own settings always take priority over anything shared.
          </p>
          <p>
            Current franchise: <b>{{ myFranchiseName() || 'None' }}</b>
            @if (myFranchiseGroupName()) {
              (group: <b>{{ myFranchiseGroupName() }}</b>)
            }
          </p>
          <mat-form-field appearance="outline">
            <mat-label>Join franchise</mat-label>
            <mat-select [(ngModel)]="selectedFranchiseId" (selectionChange)="joinFranchise()">
              <mat-option [value]="null">None</mat-option>
              @for (f of franchises(); track f.id) {
                <mat-option [value]="f.id">{{ f.name }}{{ f.group ? ' (' + f.group.name + ')' : '' }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>New franchise name</mat-label>
              <input matInput [(ngModel)]="newFranchiseName" placeholder="e.g. BMW" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Under group (optional)</mat-label>
              <mat-select [(ngModel)]="newFranchiseGroupId">
                <mat-option [value]="null">None</mat-option>
                @for (g of groups(); track g.id) {
                  <mat-option [value]="g.id">{{ g.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <button mat-stroked-button [disabled]="!newFranchiseName" (click)="createFranchise()">+ Add franchise</button>
          </div>

          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>New group name</mat-label>
              <input matInput [(ngModel)]="newGroupName" placeholder="e.g. Sytner Group" />
            </mat-form-field>
            <button mat-stroked-button [disabled]="!newGroupName" (click)="createGroup()">+ Add group</button>
          </div>
        </mat-card>
      </mat-tab>

      <mat-tab label="Branding">
        <mat-card class="section">
          <h3>Logo</h3>
          <div class="row logo-row">
            @if (theme.logoUrl(); as logo) {
              <img [src]="logo" alt="Current logo" class="logo-preview" />
            } @else {
              <span class="hint">No logo uploaded yet.</span>
            }
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" (change)="onLogoSelected($event)" #logoInput hidden />
            <button mat-stroked-button (click)="logoInput.click()">Upload logo</button>
          </div>

          <h3>Colours</h3>
          <div class="row">
            <label class="colour-field">
              Primary
              <input type="color" [(ngModel)]="profileForm.primaryColour" />
            </label>
            <label class="colour-field">
              Secondary
              <input type="color" [(ngModel)]="profileForm.secondaryColour" />
            </label>
          </div>
          <div class="preview-bar" [style.background]="profileForm.primaryColour">
            <span [style.color]="'#fff'">Toolbar preview</span>
          </div>
          <button mat-flat-button color="primary" (click)="saveProfile()">Save branding</button>
        </mat-card>
      </mat-tab>

      <mat-tab label="Document numbering">
        <mat-card class="section">
          <p class="hint">Each document type gets its own incrementing number per calendar year, e.g. DS-2026-00001.</p>
          <table mat-table [dataSource]="sequences()" class="mat-elevation-z0">
            <ng-container matColumnDef="docType">
              <th mat-header-cell *matHeaderCellDef>Document type</th>
              <td mat-cell *matCellDef="let s">{{ s.docType }}</td>
            </ng-container>
            <ng-container matColumnDef="prefix">
              <th mat-header-cell *matHeaderCellDef>Prefix</th>
              <td mat-cell *matCellDef="let s">
                <input matInput [(ngModel)]="s.prefix" class="prefix-input" />
              </td>
            </ng-container>
            <ng-container matColumnDef="nextNumber">
              <th mat-header-cell *matHeaderCellDef>Next number</th>
              <td mat-cell *matCellDef="let s">{{ s.nextNumber }}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let s">
                <button mat-button (click)="saveSequence(s)">Save</button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="sequenceColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: sequenceColumns"></tr>
          </table>
        </mat-card>
      </mat-tab>

      <mat-tab label="Batch jobs">
        <mat-card class="section">
          <h3>Scheduled jobs</h3>
          <table mat-table [dataSource]="jobDefinitions" class="mat-elevation-z0">
            <ng-container matColumnDef="label">
              <th mat-header-cell *matHeaderCellDef>Job</th>
              <td mat-cell *matCellDef="let j">
                <div class="job-label">{{ j.label }}</div>
                <div class="hint">{{ j.description }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="schedule">
              <th mat-header-cell *matHeaderCellDef>Schedule</th>
              <td mat-cell *matCellDef="let j">{{ j.schedule }}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let j">
                <button mat-stroked-button (click)="runJobNow(j.name)">Run now</button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="jobColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: jobColumns"></tr>
          </table>

          <h3>Run history</h3>
          <table mat-table [dataSource]="runs()" class="mat-elevation-z0">
            <ng-container matColumnDef="jobName">
              <th mat-header-cell *matHeaderCellDef>Job</th>
              <td mat-cell *matCellDef="let r">{{ r.jobName }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let r"><mat-chip [class]="'status-' + r.status.toLowerCase()">{{ r.status }}</mat-chip></td>
            </ng-container>
            <ng-container matColumnDef="summary">
              <th mat-header-cell *matHeaderCellDef>Summary</th>
              <td mat-cell *matCellDef="let r">{{ r.summary || r.errorMessage }}</td>
            </ng-container>
            <ng-container matColumnDef="startedAt">
              <th mat-header-cell *matHeaderCellDef>When</th>
              <td mat-cell *matCellDef="let r">{{ r.startedAt | date: 'medium' }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="runColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: runColumns"></tr>
          </table>
          @if (!runs().length) {
            <p class="hint">No runs yet — try "Run now" above.</p>
          }
        </mat-card>
      </mat-tab>

      <mat-tab label="Document templates">
        <mat-card class="section">
          <p class="hint">Create dealer-branded templates with variables, styling, and your logo for deal sheets, invoices, and other documents.</p>
          <div class="row">
            @for (t of documentTemplateTypes; track t) {
              <button mat-stroked-button (click)="newTemplate(t)">+ New {{ typeLabels[t] }} template</button>
            }
          </div>
          <table mat-table [dataSource]="templates()" class="mat-elevation-z0">
            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let t">{{ typeLabel(t.type) }}</td>
            </ng-container>
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let t">{{ t.name }}</td>
            </ng-container>
            <ng-container matColumnDef="scope">
              <th mat-header-cell *matHeaderCellDef>Scope</th>
              <td mat-cell *matCellDef="let t">{{ t.scope }}</td>
            </ng-container>
            <ng-container matColumnDef="default">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let t">
                @if (t.isDefault) {
                  <mat-chip class="status-active">Default</mat-chip>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let t">
                <button mat-button (click)="editTemplate(t.id)">Edit</button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="templateColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: templateColumns"></tr>
          </table>
          @if (!templates().length) {
            <p class="hint">No document templates yet — the built-in default is used until you create one.</p>
          }
        </mat-card>
      </mat-tab>

      <mat-tab label="Action triggers">
        <mat-card class="section">
          <p class="hint">
            Wire a user-facing lookup (e.g. searching a used car by registration) to also call an
            external OEM/DMS API, alongside the normal database search — see the "OEM lookup"
            button on Used Cars.
          </p>
          <button mat-flat-button color="primary" (click)="newActionTrigger()">+ New action trigger</button>
          <table mat-table [dataSource]="actionTriggers()" class="mat-elevation-z0">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let t">{{ t.name }}</td>
            </ng-container>
            <ng-container matColumnDef="triggerPoint">
              <th mat-header-cell *matHeaderCellDef>Fires on</th>
              <td mat-cell *matCellDef="let t">{{ triggerPointLabel(t.triggerPoint) }}</td>
            </ng-container>
            <ng-container matColumnDef="scope">
              <th mat-header-cell *matHeaderCellDef>Scope</th>
              <td mat-cell *matCellDef="let t">{{ t.scope }}</td>
            </ng-container>
            <ng-container matColumnDef="active">
              <th mat-header-cell *matHeaderCellDef>Active</th>
              <td mat-cell *matCellDef="let t">
                <mat-chip [class]="t.active ? 'status-active' : ''">{{ t.active ? 'Active' : 'Paused' }}</mat-chip>
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let t">
                <button mat-button (click)="editActionTrigger(t.id)">Edit</button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="actionTriggerColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: actionTriggerColumns"></tr>
          </table>
          @if (!actionTriggers().length) {
            <p class="hint">No action triggers configured yet.</p>
          }
        </mat-card>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: [
    `
      .section {
        padding: 16px;
        margin: 16px 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
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
      .logo-row {
        align-items: center;
      }
      .logo-preview {
        height: 48px;
        max-width: 200px;
        object-fit: contain;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        padding: 4px;
      }
      .colour-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
      }
      .colour-field input[type='color'] {
        width: 60px;
        height: 36px;
        border: none;
        cursor: pointer;
      }
      .preview-bar {
        padding: 12px 16px;
        border-radius: 6px;
        font-weight: 600;
      }
      .prefix-input {
        width: 80px;
      }
      .job-label {
        font-weight: 600;
      }
      table {
        width: 100%;
      }
      .status-success,
      .status-active {
        background: #c8e6c9;
      }
      .status-error {
        background: #ffcdd2;
      }
      .status-running {
        background: #fff9c4;
      }
    `,
  ],
})
export class SettingsComponent implements OnInit {
  readonly theme = inject(ThemeService);
  readonly sequences = signal<DocumentSequence[]>([]);
  readonly runs = signal<BatchJobRun[]>([]);
  readonly templates = signal<DocumentTemplateSummary[]>([]);

  readonly jobDefinitions = BATCH_JOB_DEFINITIONS;
  readonly typeLabels = DOCUMENT_TEMPLATE_TYPE_LABELS;
  readonly documentTemplateTypes = Object.values(DocumentTemplateType);
  readonly sequenceColumns = ['docType', 'prefix', 'nextNumber', 'actions'];
  readonly jobColumns = ['label', 'schedule', 'actions'];
  readonly runColumns = ['jobName', 'status', 'summary', 'startedAt'];
  readonly templateColumns = ['type', 'name', 'scope', 'default', 'actions'];
  readonly actionTriggerColumns = ['name', 'triggerPoint', 'scope', 'active', 'actions'];
  readonly triggerPointLabels = ACTION_TRIGGER_POINT_LABELS;

  readonly groups = signal<Group[]>([]);
  readonly franchises = signal<Franchise[]>([]);
  readonly actionTriggers = signal<ActionTriggerSummary[]>([]);
  selectedFranchiseId: string | null = null;
  newFranchiseName = '';
  newFranchiseGroupId: string | null = null;
  newGroupName = '';

  profileForm: DealerProfile = {
    id: '',
    name: '',
    address: '',
    franchiseCode: '',
    vatNumber: '',
    invoiceFooterNote: '',
    timeZone: '',
    locale: '',
    logoUrl: null,
    primaryColour: '#0066B1',
    secondaryColour: '#1C69D4',
    labourRatePerHour: 95,
    franchise: null,
  };

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.loadProfile();
    this.loadSequences();
    this.loadRuns();
    this.loadTemplates();
    this.loadOrg();
    this.loadActionTriggers();
  }

  myFranchiseName(): string | null {
    return this.profileForm.franchise?.name ?? null;
  }

  myFranchiseGroupName(): string | null {
    return this.profileForm.franchise?.group?.name ?? null;
  }

  loadOrg(): void {
    this.http.get<Group[]>(`${environment.apiUrl}/org/groups`).subscribe((data) => this.groups.set(data));
    this.http.get<Franchise[]>(`${environment.apiUrl}/org/franchises`).subscribe((data) => this.franchises.set(data));
  }

  joinFranchise(): void {
    this.http.post(`${environment.apiUrl}/org/my-dealer/franchise`, { franchiseId: this.selectedFranchiseId }).subscribe({
      next: () => {
        this.snackBar.open('Franchise updated', 'Dismiss', { duration: 2000 });
        this.loadProfile();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not update franchise', 'Dismiss', { duration: 4000 }),
    });
  }

  createFranchise(): void {
    this.http.post(`${environment.apiUrl}/org/franchises`, { name: this.newFranchiseName, groupId: this.newFranchiseGroupId }).subscribe({
      next: () => {
        this.newFranchiseName = '';
        this.newFranchiseGroupId = null;
        this.loadOrg();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not create franchise', 'Dismiss', { duration: 4000 }),
    });
  }

  createGroup(): void {
    this.http.post(`${environment.apiUrl}/org/groups`, { name: this.newGroupName }).subscribe({
      next: () => {
        this.newGroupName = '';
        this.loadOrg();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not create group', 'Dismiss', { duration: 4000 }),
    });
  }

  loadActionTriggers(): void {
    this.http.get<ActionTriggerSummary[]>(`${environment.apiUrl}/action-triggers`).subscribe((data) => this.actionTriggers.set(data));
  }

  newActionTrigger(): void {
    this.router.navigate(['/admin/action-triggers/new']);
  }

  editActionTrigger(id: string): void {
    this.router.navigate(['/admin/action-triggers', id]);
  }

  loadProfile(): void {
    this.http.get<DealerProfile>(`${environment.apiUrl}/dealers/me`).subscribe((dealer) => {
      this.profileForm = {
        ...dealer,
        primaryColour: dealer.primaryColour || '#0066B1',
        secondaryColour: dealer.secondaryColour || '#1C69D4',
      };
      this.selectedFranchiseId = dealer.franchise?.id ?? null;
    });
  }

  saveProfile(): void {
    this.http.patch(`${environment.apiUrl}/dealers/me`, this.profileForm).subscribe({
      next: () => {
        this.snackBar.open('Settings saved', 'Dismiss', { duration: 2000 });
        this.theme.load();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not save settings', 'Dismiss', { duration: 4000 }),
    });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.http.post(`${environment.apiUrl}/dealers/me/logo`, { dataUrl }).subscribe({
        next: () => {
          this.snackBar.open('Logo updated', 'Dismiss', { duration: 2000 });
          this.theme.load();
        },
        error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not upload logo', 'Dismiss', { duration: 4000 }),
      });
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  loadSequences(): void {
    this.http.get<DocumentSequence[]>(`${environment.apiUrl}/dealers/me/document-sequences`).subscribe((data) => this.sequences.set(data));
  }

  saveSequence(sequence: DocumentSequence): void {
    this.http
      .patch(`${environment.apiUrl}/dealers/me/document-sequences/${sequence.id}`, { prefix: sequence.prefix })
      .subscribe(() => this.snackBar.open('Document numbering saved', 'Dismiss', { duration: 2000 }));
  }

  loadRuns(): void {
    this.http.get<BatchJobRun[]>(`${environment.apiUrl}/admin/batch-jobs/runs`).subscribe((data) => this.runs.set(data));
  }

  runJobNow(jobName: BatchJobName): void {
    this.http.post(`${environment.apiUrl}/admin/batch-jobs/${jobName}/run`, {}).subscribe({
      next: () => {
        this.snackBar.open('Job run complete', 'Dismiss', { duration: 2000 });
        this.loadRuns();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Job run failed', 'Dismiss', { duration: 4000 }),
    });
  }

  loadTemplates(): void {
    this.http.get<DocumentTemplateSummary[]>(`${environment.apiUrl}/document-templates`).subscribe((data) => this.templates.set(data));
  }

  newTemplate(type: DocumentTemplateType): void {
    this.router.navigate(['/admin/document-templates/new'], { queryParams: { type } });
  }

  editTemplate(id: string): void {
    this.router.navigate(['/admin/document-templates', id]);
  }

  typeLabel(type: string): string {
    return (this.typeLabels as Record<string, string>)[type] ?? type;
  }

  triggerPointLabel(triggerPoint: string): string {
    return (this.triggerPointLabels as Record<string, string>)[triggerPoint] ?? triggerPoint;
  }
}

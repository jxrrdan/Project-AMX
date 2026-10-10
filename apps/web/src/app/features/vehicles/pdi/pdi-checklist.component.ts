import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth.service';
import { PdiChecklistItem, PdiOfflineService } from './pdi-offline.service';

interface CategoryGroup {
  category: string;
  items: PdiChecklistItem[];
}

@Component({
  selector: 'app-pdi-checklist',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="header">
      <button mat-icon-button (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
      <span class="title">PDI checklist</span>
    </div>

    <!-- Connectivity / sync status. Always rendered so a technician can trust what will happen. -->
    <div class="sync-bar" [class.offline]="!pdi.online()" [class.pending]="pdi.online() && pdi.hasPending()">
      <mat-icon>{{ pdi.online() ? (pdi.hasPending() ? 'sync' : 'cloud_done') : 'cloud_off' }}</mat-icon>
      @if (!pdi.online()) {
        <span>Offline — your ratings are saved on this device and will upload when you're back in range.</span>
      } @else if (pdi.hasPending()) {
        <span>{{ pdi.syncing() ? 'Uploading' : 'Waiting to upload' }} {{ pdi.pendingCount() }} change(s)…</span>
      } @else {
        <span>All changes saved.</span>
      }
    </div>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" />
    } @else if (job(); as j) {
      <p class="meta">
        Scheduled {{ j.scheduledDate | date: 'mediumDate' }} ·
        <span class="status status-{{ j.status }}">{{ statusLabel(j.status) }}</span>
        @if (pdi.loadedFromCache()) { · <span class="cache-note">cached copy</span> }
      </p>

      <p class="progress-line">{{ ratedCount() }} of {{ totalCount() }} items rated</p>
      <mat-progress-bar mode="determinate" [value]="percent()" />

      @for (group of groups(); track group.category) {
        <mat-card class="group">
          <h3>{{ group.category }}</h3>
          @for (item of group.items; track item.id) {
            <div class="item">
              <div class="item-label">{{ item.label }}</div>
              <div class="ratings">
                <button
                  mat-stroked-button
                  class="rate pass"
                  [class.selected]="item.rating === 'PASS'"
                  [disabled]="isComplete()"
                  (click)="rate(item, 'PASS')"
                >
                  Pass
                </button>
                <button
                  mat-stroked-button
                  class="rate advisory"
                  [class.selected]="item.rating === 'ADVISORY'"
                  [disabled]="isComplete()"
                  (click)="rate(item, 'ADVISORY')"
                >
                  Advisory
                </button>
                <button
                  mat-stroked-button
                  class="rate fail"
                  [class.selected]="item.rating === 'FAIL'"
                  [disabled]="isComplete()"
                  (click)="rate(item, 'FAIL')"
                >
                  Fail
                </button>
              </div>
              @if (item.rating === 'ADVISORY' || item.rating === 'FAIL') {
                <mat-form-field appearance="outline" class="notes">
                  <mat-label>Notes</mat-label>
                  <input
                    matInput
                    [ngModel]="item.notes"
                    [disabled]="isComplete()"
                    (blur)="saveNotes(item, $event)"
                    placeholder="Describe the advisory / fault"
                  />
                </mat-form-field>
              }
            </div>
          }
        </mat-card>
      }

      @if (isComplete()) {
        <mat-card class="signed">
          <mat-icon>verified</mat-icon>
          <div>
            <strong>Signed off</strong>
            @if (j.signedOffBy) { by {{ j.signedOffBy }} }
            @if (j.signedOffAt) { on {{ j.signedOffAt | date: 'medium' }} }
            @if (pdi.hasPending()) { <em>(will finalise on the server once uploaded)</em> }
          </div>
          @if (j.checklistPdfUrl && pdi.online()) {
            <a mat-stroked-button [href]="storageUrl(j.checklistPdfUrl)" target="_blank" rel="noopener">
              <mat-icon>picture_as_pdf</mat-icon> View PDF
            </a>
          }
        </mat-card>
      } @else {
        <mat-card class="signoff">
          <h3>Sign off</h3>
          <p class="hint">All {{ totalCount() }} items must be rated before sign-off.</p>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Signed off by</mat-label>
            <input matInput [(ngModel)]="signedOffBy" />
          </mat-form-field>
          <button
            mat-flat-button
            color="primary"
            [disabled]="!allRated() || !signedOffBy.trim()"
            (click)="signOff(j.id)"
          >
            Sign off PDI
          </button>
        </mat-card>
      }
    } @else {
      <mat-card class="empty">
        <p>No PDI checklist has been scheduled for this vehicle yet.</p>
        <button mat-stroked-button (click)="back()">Back to vehicle</button>
      </mat-card>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 720px;
      }
      .header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .title {
        font-size: 18px;
        font-weight: 600;
      }
      .sync-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 13px;
        background: var(--amx-success-bg);
        color: #1b5e20;
        margin: 8px 0 16px;
      }
      .sync-bar.offline {
        background: var(--amx-warning-bg);
        color: var(--amx-warning-fg);
      }
      .sync-bar.pending {
        background: var(--amx-info-bg);
        color: var(--amx-info-fg);
      }
      .meta {
        color: var(--amx-text-secondary);
        margin: 0 0 8px;
      }
      .status {
        font-weight: 600;
      }
      .status-COMPLETE {
        color: var(--amx-success-fg);
      }
      .cache-note {
        font-style: italic;
      }
      .progress-line {
        margin: 8px 0 4px;
        font-size: 13px;
      }
      .group {
        padding: 16px;
        margin: 16px 0;
      }
      .group h3 {
        margin: 0 0 8px;
      }
      .item {
        padding: 10px 0;
        border-bottom: 1px solid var(--amx-border-subtle);
      }
      .item:last-child {
        border-bottom: none;
      }
      .item-label {
        margin-bottom: 6px;
      }
      .ratings {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .rate.selected.pass {
        background: var(--amx-success-fg);
        color: #fff;
      }
      .rate.selected.advisory {
        background: #f9a825;
        color: #000;
      }
      .rate.selected.fail {
        background: var(--amx-danger-fg);
        color: #fff;
      }
      .notes {
        width: 100%;
        margin-top: 8px;
      }
      .full-width {
        width: 100%;
      }
      .signoff,
      .signed,
      .empty {
        padding: 16px;
        margin: 16px 0 48px;
      }
      .signed {
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--amx-success-bg);
      }
      .hint {
        font-size: 12px;
        color: var(--amx-text-tertiary);
      }
    `,
  ],
})
export class PdiChecklistComponent implements OnInit {
  readonly pdi = inject(PdiOfflineService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly job = this.pdi.job;
  private vehicleId = '';

  signedOffBy = '';

  readonly groups = computed<CategoryGroup[]>(() => {
    const j = this.job();
    if (!j) {
      return [];
    }
    const byCategory = new Map<string, PdiChecklistItem[]>();
    for (const item of [...j.checklistItems].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }
    return [...byCategory.entries()].map(([category, items]) => ({ category, items }));
  });

  readonly totalCount = computed(() => this.job()?.checklistItems.length ?? 0);
  readonly ratedCount = computed(() => this.job()?.checklistItems.filter((i) => !!i.rating).length ?? 0);
  readonly allRated = computed(() => this.totalCount() > 0 && this.ratedCount() === this.totalCount());
  readonly percent = computed(() => (this.totalCount() ? Math.round((this.ratedCount() / this.totalCount()) * 100) : 0));

  async ngOnInit(): Promise<void> {
    this.vehicleId = this.route.snapshot.paramMap.get('id') ?? '';
    const user = this.auth.user();
    this.signedOffBy = user ? `${user.firstName} ${user.lastName}`.trim() : '';
    await this.pdi.load(this.vehicleId);
    this.loading.set(false);
  }

  isComplete(): boolean {
    return this.job()?.status === 'COMPLETE';
  }

  statusLabel(status: string): string {
    return status === 'COMPLETE' ? 'Complete' : status === 'IN_PROGRESS' ? 'In progress' : 'Scheduled';
  }

  async rate(item: PdiChecklistItem, rating: 'PASS' | 'ADVISORY' | 'FAIL'): Promise<void> {
    // Passing an item clears any advisory/fault note; advisory/fail keep the existing note.
    const notes = rating === 'PASS' ? null : item.notes;
    await this.pdi.rateItem(item.id, rating, notes);
  }

  async saveNotes(item: PdiChecklistItem, event: Event): Promise<void> {
    if (!item.rating || item.rating === 'PASS') {
      return;
    }
    const value = (event.target as HTMLInputElement).value.trim();
    if ((item.notes ?? '') === value) {
      return;
    }
    await this.pdi.rateItem(item.id, item.rating, value || null);
  }

  async signOff(jobId: string): Promise<void> {
    if (!this.allRated()) {
      this.snackBar.open('Rate every item before signing off', 'Dismiss', { duration: 3000 });
      return;
    }
    await this.pdi.signOff(jobId, this.signedOffBy.trim());
    this.snackBar.open(
      this.pdi.online() ? 'PDI signed off' : 'PDI signed off — will upload when back online',
      'Dismiss',
      { duration: 3000 },
    );
  }

  storageUrl(path: string): string {
    return `${environment.apiUrl.replace(/\/api$/, '')}${path}`;
  }

  back(): void {
    this.router.navigate(['/vehicles', this.vehicleId]);
  }
}

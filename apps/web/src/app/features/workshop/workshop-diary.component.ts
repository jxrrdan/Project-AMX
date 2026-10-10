import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { JOB_TYPE_COLOURS, JobType } from '@project-amx/shared';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { FlickDragDirective, FlickDropEvent } from '../../shared/flick-drag.directive';

interface Bay {
  id: string;
  name: string;
}

interface JobCard {
  id: string;
  customerName: string;
  vehicleReg: string | null;
  jobType: JobType;
  status: string;
  bayId: string | null;
  estimatedHours: number;
  assignedTechnician?: { firstName: string; lastName: string } | null;
}

@Component({
  selector: 'app-workshop-diary',
  imports: [FlickDragDirective, RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatIconModule, MatMenuModule],
  template: `
    <div class="header">
      <h1>Workshop Diary</h1>
      <div class="header-actions">
        <a mat-stroked-button routerLink="/workshop/loading">
          <mat-icon>bar_chart</mat-icon>
          Loading &amp; parts
        </a>
        <span class="live-indicator" [class.connected]="wsConnected()">
          <mat-icon>{{ wsConnected() ? 'wifi' : 'wifi_off' }}</mat-icon>
          {{ wsConnected() ? 'Live' : 'Offline' }}
        </span>
      </div>
    </div>

    <p class="sr-only" aria-live="polite">{{ announcement() }}</p>
    <div class="board" data-drag-bounds>
      @for (bay of bays(); track bay.id) {
        <div class="column">
          <h3>{{ bay.name }} <span class="count">{{ byBay(bay.id).length }}</span></h3>
          <div class="drop-list" [attr.data-drop-zone]="bay.id">
            @for (job of byBay(bay.id); track job.id) {
              <mat-card class="job-card" [appFlickDrag]="job" (flickDrop)="onFlickDrop($event)" [style.border-left-color]="colourFor(job.jobType)">
                <div class="job-card-header">
                  <div class="job-type">{{ job.jobType }}</div>
                  <span class="card-actions">
                    <button mat-icon-button type="button" [matMenuTriggerFor]="moveMenu" [matMenuTriggerData]="{ job: job }" aria-label="Move to another bay" (click)="$event.stopPropagation()">
                      <mat-icon>swap_horiz</mat-icon>
                    </button>
                    <a mat-icon-button [routerLink]="['/workshop/job-cards', job.id]" aria-label="Open job card" (click)="$event.stopPropagation()">
                      <mat-icon>open_in_new</mat-icon>
                    </a>
                  </span>
                </div>
                <div class="customer">{{ job.customerName }}</div>
                @if (job.vehicleReg) {
                  <div class="reg">{{ job.vehicleReg }}</div>
                }
                <mat-chip-set>
                  <mat-chip>{{ job.status }}</mat-chip>
                </mat-chip-set>
                @if (job.assignedTechnician) {
                  <div class="tech">{{ job.assignedTechnician.firstName }} {{ job.assignedTechnician.lastName }}</div>
                }
              </mat-card>
            }
          </div>
        </div>
      }
      <div class="column">
        <h3>Unassigned <span class="count">{{ byBay(null).length }}</span></h3>
        <div class="drop-list" data-drop-zone="unassigned">
          @for (job of byBay(null); track job.id) {
            <mat-card class="job-card" [appFlickDrag]="job" (flickDrop)="onFlickDrop($event)">
              <div class="job-card-header">
                <div class="job-type">{{ job.jobType }}</div>
                <span class="card-actions">
                  <button mat-icon-button type="button" [matMenuTriggerFor]="moveMenu" [matMenuTriggerData]="{ job: job }" aria-label="Move to a bay" (click)="$event.stopPropagation()">
                    <mat-icon>swap_horiz</mat-icon>
                  </button>
                </span>
              </div>
              <div class="customer">{{ job.customerName }}</div>
            </mat-card>
          }
        </div>
      </div>
    </div>

    <!-- Keyboard / assistive-tech alternative to dragging: the same move, as a menu. -->
    <mat-menu #moveMenu="matMenu">
      <ng-template matMenuContent let-job="job">
        @for (bay of bays(); track bay.id) {
          @if (bay.id !== job.bayId) {
            <button mat-menu-item (click)="moveTo(job, bay.id)">{{ bay.name }}</button>
          }
        }
        @if (job.bayId) {
          <button mat-menu-item (click)="moveTo(job, null)">Unassigned</button>
        }
      </ng-template>
    </mat-menu>
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .live-indicator {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--amx-danger-fg);
      }
      .live-indicator.connected {
        color: var(--amx-success-fg);
      }
      .board {
        display: flex;
        gap: 12px;
        overflow-x: auto;
      }
      .column {
        min-width: 240px;
        flex: 0 0 240px;
      }
      .column h3 {
        font-size: 13px;
        color: var(--amx-text-secondary);
        display: flex;
        justify-content: space-between;
      }
      .count {
        background: var(--amx-border);
        border-radius: 10px;
        padding: 0 8px;
        font-size: 11px;
      }
      .drop-list {
        min-height: 100px;
        background: var(--amx-surface-sunken);
        border-radius: 16px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        outline: 2px solid transparent;
        outline-offset: -2px;
        transition:
          outline-color 200ms var(--amx-ease, ease),
          background-color 200ms var(--amx-ease, ease);
      }
      .job-card {
        padding: 12px;
        cursor: grab;
        border-left: 4px solid #0066b1;
      }
      .card-actions {
        display: inline-flex;
      }
      .card-actions a,
      .card-actions button {
        width: 32px;
        height: 32px;
        padding: 4px;
        --mat-icon-button-state-layer-size: 32px;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .job-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .job-type {
        font-size: 11px;
        color: var(--amx-text-tertiary);
      }
      .customer {
        font-weight: 600;
      }
      .reg,
      .tech {
        font-size: 12px;
        margin-top: 4px;
      }
    `,
  ],
})
export class WorkshopDiaryComponent implements OnInit, OnDestroy {
  readonly bays = signal<Bay[]>([]);
  readonly jobCards = signal<JobCard[]>([]);
  readonly wsConnected = signal(false);
  readonly announcement = signal('');
  /** The column the dragged card is currently over (highlights only the real destination). */
  readonly overList = signal<string | null>(null);
  private socket: Socket | null = null;

  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    this.load();
    this.connectSocket();
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
  }

  load(): void {
    this.http.get<Bay[]>(`${environment.apiUrl}/bays`).subscribe((data) => this.bays.set(data));
    this.http.get<JobCard[]>(`${environment.apiUrl}/job-cards`).subscribe((data) => this.jobCards.set(data));
  }

  byBay(bayId: string | null): JobCard[] {
    return this.jobCards().filter((j) => j.bayId === bayId);
  }

  colourFor(jobType: JobType): string {
    return JOB_TYPE_COLOURS[jobType];
  }

  /** A card was dropped or flicked into a column (`unassigned` is the no-bay column). */
  onFlickDrop(event: FlickDropEvent): void {
    this.moveTo(event.data as JobCard, event.zone === 'unassigned' ? null : event.zone);
  }

  /**
   * The single place a job changes bay (drag, menu or keyboard). The change is applied to the signal
   * immediately (optimistic, immutable, so the view re-renders), then saved; on failure the board is
   * reloaded from the server so it never shows a state the API rejected.
   */
  moveTo(job: JobCard, targetBayId: string | null): void {
    if (job.bayId === targetBayId) {
      return;
    }
    const previous = this.jobCards();
    this.jobCards.set(previous.map((j) => (j.id === job.id ? { ...j, bayId: targetBayId } : j)));
    const bayName = targetBayId ? this.bays().find((b) => b.id === targetBayId)?.name ?? 'bay' : 'Unassigned';
    this.announcement.set(`${job.customerName} moved to ${bayName}`);

    this.http.patch(`${environment.apiUrl}/job-cards/${job.id}`, { bayId: targetBayId }).subscribe({
      error: () => {
        this.jobCards.set(previous);
        this.announcement.set(`Could not move ${job.customerName}; the board was restored`);
        this.load();
      },
    });
  }

  private connectSocket(): void {
    this.socket = io(environment.wsUrl, {
      path: '/api/socket.io',
      // WebSocket only: with several API tasks behind the ALB, long-polling would need sticky sessions.
      transports: ['websocket'],
      auth: { token: this.auth.accessToken },
    });
    this.socket.on('connect', () => this.wsConnected.set(true));
    this.socket.on('disconnect', () => this.wsConnected.set(false));
    this.socket.on('job-card.changed', () => this.load());
  }
}

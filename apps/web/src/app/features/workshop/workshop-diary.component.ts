import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule, transferArrayItem, moveItemInArray } from '@angular/cdk/drag-drop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { JOB_TYPE_COLOURS, JobType } from '@project-amx/shared';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';

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
  imports: [DragDropModule, RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatIconModule],
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

    <div class="board" cdkDropListGroup>
      @for (bay of bays(); track bay.id) {
        <div class="column">
          <h3>{{ bay.name }} <span class="count">{{ byBay(bay.id).length }}</span></h3>
          <div class="drop-list" cdkDropList [cdkDropListData]="byBay(bay.id)" [id]="bay.id" (cdkDropListDropped)="drop($event, bay.id)">
            @for (job of byBay(bay.id); track job.id) {
              <mat-card class="job-card" cdkDrag [style.border-left-color]="colourFor(job.jobType)">
                <div class="job-card-header">
                  <div class="job-type">{{ job.jobType }}</div>
                  <a mat-icon-button [routerLink]="['/workshop/job-cards', job.id]" (click)="$event.stopPropagation()">
                    <mat-icon>open_in_new</mat-icon>
                  </a>
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
        <div class="drop-list" cdkDropList [cdkDropListData]="byBay(null)" id="unassigned" (cdkDropListDropped)="drop($event, null)">
          @for (job of byBay(null); track job.id) {
            <mat-card class="job-card" cdkDrag>
              <div class="job-type">{{ job.jobType }}</div>
              <div class="customer">{{ job.customerName }}</div>
            </mat-card>
          }
        </div>
      </div>
    </div>
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
        color: #c62828;
      }
      .live-indicator.connected {
        color: #2e7d32;
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
        color: rgba(0, 0, 0, 0.6);
        display: flex;
        justify-content: space-between;
      }
      .count {
        background: #e0e0e0;
        border-radius: 10px;
        padding: 0 8px;
        font-size: 11px;
      }
      .drop-list {
        min-height: 100px;
        background: #eceff1;
        border-radius: 8px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .job-card {
        padding: 12px;
        cursor: grab;
        border-left: 4px solid #0066b1;
      }
      .job-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .job-card-header a {
        width: 24px;
        height: 24px;
        line-height: 24px;
      }
      .job-type {
        font-size: 11px;
        color: rgba(0, 0, 0, 0.5);
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

  drop(event: CdkDragDrop<JobCard[]>, targetBayId: string | null): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const job = event.previousContainer.data[event.previousIndex];
    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    job.bayId = targetBayId;

    this.http.patch(`${environment.apiUrl}/job-cards/${job.id}`, { bayId: targetBayId }).subscribe({
      error: () => this.load(),
    });
  }

  private connectSocket(): void {
    this.socket = io(environment.wsUrl, { auth: { token: this.auth.accessToken } });
    this.socket.on('connect', () => this.wsConnected.set(true));
    this.socket.on('disconnect', () => this.wsConnected.set(false));
    this.socket.on('job-card.changed', () => this.load());
  }
}

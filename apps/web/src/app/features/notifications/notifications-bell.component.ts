import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { environment } from '../../../environments/environment';

interface Notification {
  id: string;
  eventType: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

/** In-app notification centre (bell icon) — surfaces what BatchJobsService and other background
 * work have written via NotificationsService, so a nightly/monthly job isn't invisible to the user
 * who happens not to be looking at the exact screen it relates to. */
@Component({
  selector: 'app-notifications-bell',
  imports: [DatePipe, MatBadgeModule, MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <button mat-icon-button [matMenuTriggerFor]="menu" (menuOpened)="onOpen()">
      @if (unreadCount() > 0) {
        <mat-icon [matBadge]="unreadCount()" matBadgeColor="warn" matBadgeSize="small">notifications</mat-icon>
      } @else {
        <mat-icon>notifications</mat-icon>
      }
    </button>
    <mat-menu #menu="matMenu" class="notifications-menu">
      <div class="header">Notifications</div>
      @for (n of notifications(); track n.id) {
        <button mat-menu-item [class.unread]="!n.readAt" (click)="markRead(n)">
          <div class="item">
            <span class="title">{{ n.title }}</span>
            <span class="body">{{ n.body }}</span>
            <span class="date">{{ n.createdAt | date: 'medium' }}</span>
          </div>
        </button>
      }
      @if (!notifications().length) {
        <div class="empty">No notifications yet.</div>
      }
    </mat-menu>
  `,
  styles: [
    `
      .header {
        padding: 8px 16px;
        font-weight: 600;
        font-size: 13px;
        color: rgba(0, 0, 0, 0.6);
      }
      .item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        white-space: normal;
        line-height: 1.3;
        padding: 4px 0;
      }
      .title {
        font-weight: 600;
        font-size: 13px;
      }
      .body {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.7);
      }
      .date {
        font-size: 11px;
        color: rgba(0, 0, 0, 0.45);
      }
      .unread {
        background: rgba(0, 102, 177, 0.06);
      }
      .empty {
        padding: 12px 16px;
        font-size: 13px;
        color: rgba(0, 0, 0, 0.5);
      }
    `,
  ],
})
export class NotificationsBellComponent implements OnInit {
  readonly notifications = signal<Notification[]>([]);
  readonly unreadCount = signal(0);

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
  }

  onOpen(): void {
    this.load();
  }

  load(): void {
    this.http.get<Notification[]>(`${environment.apiUrl}/notifications`).subscribe((data) => {
      this.notifications.set(data);
      this.unreadCount.set(data.filter((n) => !n.readAt).length);
    });
  }

  markRead(n: Notification): void {
    if (n.readAt) return;
    this.http.patch(`${environment.apiUrl}/notifications/${n.id}/read`, {}).subscribe(() => this.load());
  }
}

import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ONLINE_BOOKING_STATUS_LABELS, OnlineBookingStatus } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface BookingRequest {
  id: string;
  customerName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  vehicleReg: string;
  serviceType: string;
  preferredDate: string | null;
  notes: string | null;
  status: OnlineBookingStatus;
  createdAt: string;
}

@Component({
  selector: 'app-online-bookings',
  imports: [DatePipe, FormsModule, MatButtonModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatSelectModule, MatTableModule],
  template: `
    <h1>Online Booking Requests</h1>
    <p class="hint">Requests submitted through the public portal. Triage each one and convert accepted requests into a workshop booking.</p>
    <table mat-table [dataSource]="requests()" class="mat-elevation-z1">
      <ng-container matColumnDef="created"><th mat-header-cell *matHeaderCellDef>Received</th><td mat-cell *matCellDef="let r">{{ r.createdAt | date: 'short' }}</td></ng-container>
      <ng-container matColumnDef="customer"><th mat-header-cell *matHeaderCellDef>Customer</th><td mat-cell *matCellDef="let r">{{ r.customerName }}<br /><span class="muted">{{ r.contactEmail || r.contactPhone }}</span></td></ng-container>
      <ng-container matColumnDef="vehicle"><th mat-header-cell *matHeaderCellDef>Vehicle / service</th><td mat-cell *matCellDef="let r">{{ r.vehicleReg }} · {{ r.serviceType }}</td></ng-container>
      <ng-container matColumnDef="preferred"><th mat-header-cell *matHeaderCellDef>Preferred</th><td mat-cell *matCellDef="let r">{{ r.preferredDate ? (r.preferredDate | date: 'shortDate') : '—' }}</td></ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Status</th>
        <td mat-cell *matCellDef="let r">
          <mat-form-field appearance="outline" class="status-select" subscriptSizing="dynamic">
            <mat-select [ngModel]="r.status" (ngModelChange)="setStatus(r, $event)">
              @for (s of statuses; track s) { <mat-option [value]="s">{{ statusLabels[s] }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
    @if (!requests().length) { <p class="empty">No booking requests yet.</p> }
  `,
  styles: [`
    .hint { color: var(--amx-text-secondary); }
    table { width: 100%; }
    .muted { color: var(--amx-text-tertiary); font-size: 12px; }
    .status-select { width: 150px; }
    .empty { color: var(--amx-text-tertiary); margin-top: 16px; }
  `],
})
export class OnlineBookingsComponent implements OnInit {
  readonly requests = signal<BookingRequest[]>([]);
  readonly columns = ['created', 'customer', 'vehicle', 'preferred', 'status'];
  readonly statuses = Object.values(OnlineBookingStatus);
  readonly statusLabels = ONLINE_BOOKING_STATUS_LABELS;

  private readonly http = inject(HttpClient);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.http.get<BookingRequest[]>(`${environment.apiUrl}/online-bookings`).subscribe((d) => this.requests.set(d));
  }

  setStatus(r: BookingRequest, status: OnlineBookingStatus): void {
    if (r.status === status) return;
    this.http.patch(`${environment.apiUrl}/online-bookings/${r.id}`, { status }).subscribe(() => this.load());
  }
}

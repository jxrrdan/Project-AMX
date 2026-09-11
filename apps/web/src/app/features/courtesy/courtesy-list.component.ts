import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CourtesyVehicleStatus } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface Booking {
  id: string;
  customerName: string;
  outDate: string;
  expectedReturnDate: string;
  actualReturnDate: string | null;
}

interface CourtesyVehicle {
  id: string;
  reg: string;
  make: string;
  model: string;
  status: CourtesyVehicleStatus;
  insuranceExpiry: string | null;
  motExpiry: string | null;
  taxExpiry: string | null;
  bookings: Booking[];
}

@Component({
  selector: 'app-courtesy-list',
  imports: [DatePipe, FormsModule, MatCardModule, MatChipsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <div class="header">
      <h1>Courtesy &amp; Loan Car Fleet</h1>
      <button mat-flat-button color="primary" (click)="showForm.set(!showForm())">
        <mat-icon>add</mat-icon>
        Add vehicle
      </button>
    </div>

    @if (alerts().length) {
      <mat-card class="alerts">
        <mat-icon>warning</mat-icon>
        {{ alerts().length }} vehicle(s) have insurance, MOT, or tax expiring within 30 days.
      </mat-card>
    }

    @if (showForm()) {
      <mat-card class="form-card">
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Registration</mat-label>
            <input matInput [(ngModel)]="form.reg" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Make</mat-label>
            <input matInput [(ngModel)]="form.make" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Model</mat-label>
            <input matInput [(ngModel)]="form.model" />
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Insurance expiry</mat-label>
            <input matInput type="date" [(ngModel)]="form.insuranceExpiry" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>MOT expiry</mat-label>
            <input matInput type="date" [(ngModel)]="form.motExpiry" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Tax expiry</mat-label>
            <input matInput type="date" [(ngModel)]="form.taxExpiry" />
          </mat-form-field>
        </div>
        <button mat-flat-button color="primary" [disabled]="!form.reg || !form.make || !form.model" (click)="createVehicle()">
          Save
        </button>
      </mat-card>
    }

    <div class="grid">
      @for (v of fleet(); track v.id) {
        <mat-card>
          <div class="reg">{{ v.reg }}</div>
          <div class="model">{{ v.make }} {{ v.model }}</div>
          <mat-chip-set><mat-chip>{{ v.status }}</mat-chip></mat-chip-set>

          @if (v.status === 'AVAILABLE') {
            <button mat-button (click)="openBookingForm(v.id)">Book out</button>
          }
          @for (b of activeBookings(v); track b.id) {
            <div class="booking">
              <span>{{ b.customerName }}</span>
              <span class="date">due {{ b.expectedReturnDate | date: 'd MMM' }}</span>
              <button mat-button (click)="openReturnForm(b.id)">Return</button>
            </div>
          }
        </mat-card>
      }
    </div>

    @if (bookingVehicleId(); as vid) {
      <mat-card class="modal-card">
        <h3>Book out {{ regFor(vid) }}</h3>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Customer name</mat-label>
          <input matInput [(ngModel)]="bookingForm.customerName" />
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Out date</mat-label>
            <input matInput type="date" [(ngModel)]="bookingForm.outDate" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Expected return</mat-label>
            <input matInput type="date" [(ngModel)]="bookingForm.expectedReturnDate" />
          </mat-form-field>
        </div>
        <div class="row">
          <button
            mat-flat-button
            color="primary"
            [disabled]="!bookingForm.customerName || !bookingForm.outDate || !bookingForm.expectedReturnDate"
            (click)="createBooking(vid)"
          >
            Confirm
          </button>
          <button mat-button (click)="bookingVehicleId.set(null)">Cancel</button>
        </div>
      </mat-card>
    }

    @if (returnBookingId()) {
      <mat-card class="modal-card">
        <h3>Return vehicle</h3>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Return mileage</mat-label>
          <input matInput type="number" [(ngModel)]="returnForm.returnMileage" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Any new damage?</mat-label>
          <textarea matInput rows="2" [(ngModel)]="returnForm.newDamageNotes"></textarea>
        </mat-form-field>
        <div class="row">
          <button mat-flat-button color="primary" [disabled]="returnForm.returnMileage === null" (click)="submitReturn()">Confirm return</button>
          <button mat-button (click)="returnBookingId.set(null)">Cancel</button>
        </div>
      </mat-card>
    }
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .alerts {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #fff3e0;
        padding: 12px 16px;
        margin-bottom: 16px;
      }
      .form-card,
      .modal-card {
        max-width: 600px;
        padding: 16px;
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .row {
        display: flex;
        gap: 12px;
      }
      .row mat-form-field {
        flex: 1;
      }
      .full-width {
        width: 100%;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 16px;
      }
      mat-card {
        padding: 16px;
      }
      .reg {
        font-size: 11px;
        color: rgba(0, 0, 0, 0.5);
      }
      .model {
        font-weight: 600;
        margin-bottom: 8px;
      }
      .booking {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        margin-top: 8px;
      }
      .date {
        color: rgba(0, 0, 0, 0.5);
      }
    `,
  ],
})
export class CourtesyListComponent implements OnInit {
  readonly fleet = signal<CourtesyVehicle[]>([]);
  readonly alerts = signal<CourtesyVehicle[]>([]);
  readonly showForm = signal(false);
  readonly bookingVehicleId = signal<string | null>(null);
  readonly returnBookingId = signal<string | null>(null);

  form = { reg: '', make: '', model: '', insuranceExpiry: '', motExpiry: '', taxExpiry: '' };
  bookingForm = { customerName: '', outDate: '', expectedReturnDate: '' };
  returnForm = { returnMileage: null as number | null, newDamageNotes: '' };

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.http.get<CourtesyVehicle[]>(`${environment.apiUrl}/courtesy-fleet/vehicles`).subscribe((data) => this.fleet.set(data));
    this.http
      .get<CourtesyVehicle[]>(`${environment.apiUrl}/courtesy-fleet/vehicles/expiry-alerts`)
      .subscribe((data) => this.alerts.set(data));
  }

  activeBookings(vehicle: CourtesyVehicle): Booking[] {
    return vehicle.bookings.filter((b) => !b.actualReturnDate);
  }

  regFor(vehicleId: string): string {
    return this.fleet().find((v) => v.id === vehicleId)?.reg ?? '';
  }

  createVehicle(): void {
    const payload = {
      reg: this.form.reg,
      make: this.form.make,
      model: this.form.model,
      insuranceExpiry: this.form.insuranceExpiry || undefined,
      motExpiry: this.form.motExpiry || undefined,
      taxExpiry: this.form.taxExpiry || undefined,
    };
    this.http.post(`${environment.apiUrl}/courtesy-fleet/vehicles`, payload).subscribe(() => {
      this.showForm.set(false);
      this.form = { reg: '', make: '', model: '', insuranceExpiry: '', motExpiry: '', taxExpiry: '' };
      this.load();
    });
  }

  openBookingForm(vehicleId: string): void {
    this.bookingVehicleId.set(vehicleId);
  }

  createBooking(vehicleId: string): void {
    this.http
      .post(`${environment.apiUrl}/courtesy-fleet/bookings`, { courtesyVehicleId: vehicleId, ...this.bookingForm })
      .subscribe(() => {
        this.bookingVehicleId.set(null);
        this.bookingForm = { customerName: '', outDate: '', expectedReturnDate: '' };
        this.load();
      });
  }

  openReturnForm(bookingId: string): void {
    this.returnBookingId.set(bookingId);
  }

  submitReturn(): void {
    const id = this.returnBookingId();
    if (!id) return;
    this.http.post(`${environment.apiUrl}/courtesy-fleet/bookings/${id}/return`, this.returnForm).subscribe(() => {
      this.returnBookingId.set(null);
      this.returnForm = { returnMileage: null, newDamageNotes: '' };
      this.load();
    });
  }
}

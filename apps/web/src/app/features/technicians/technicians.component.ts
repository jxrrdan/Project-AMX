import { SlicePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import {
  JOB_CATEGORY_LABELS,
  JobCategory,
  TECHNICIAN_AVAILABILITY_LABELS,
  TechnicianAvailabilityStatus,
} from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  technicianSkills: { category: JobCategory }[];
}

interface AvailabilityRow {
  id: string;
  userId: string;
  date: string;
  status: TechnicianAvailabilityStatus;
  availableMinutes: number;
  note: string | null;
  user: { id: string; firstName: string; lastName: string };
}

interface CapacityRow {
  category: JobCategory;
  date: string;
  capacityMinutes: number;
  bookedMinutes: number;
  utilisationPct: number | null;
}

/** Technician skills + calendar-driven workshop capacity (gap closed from the bay-only
 * CapacityBlock model) — who is qualified for which job category, who is in/out on a given day,
 * and therefore how many hours of mechanical/EV/etc work the workshop can actually deliver. */
@Component({
  selector: 'app-technicians',
  imports: [
    FormsModule,
    SlicePipe,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
  ],
  template: `
    <div class="header">
      <h1>Technicians</h1>
    </div>

    <mat-card class="section">
      <h3>Skills</h3>
      <p class="hint">Which job categories each technician is qualified for — drives the capacity report below.</p>
      @for (tech of technicians(); track tech.id) {
        <div class="tech-row">
          <span class="tech-name">{{ tech.firstName }} {{ tech.lastName }}</span>
          <div class="skill-checks">
            @for (category of categories; track category) {
              <mat-checkbox
                [checked]="hasSkill(tech, category)"
                (change)="toggleSkill(tech, category, $event.checked)"
              >
                {{ categoryLabels[category] }}
              </mat-checkbox>
            }
          </div>
        </div>
      }
      @if (!technicians().length) {
        <p class="hint">No users with the Technician role yet — add one under Users &amp; Roles.</p>
      }
    </mat-card>

    <mat-card class="section">
      <h3>Calendar — who's in / who's out</h3>
      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>Technician</mat-label>
          <mat-select [(ngModel)]="availabilityForm.userId">
            @for (tech of technicians(); track tech.id) {
              <mat-option [value]="tech.id">{{ tech.firstName }} {{ tech.lastName }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Date</mat-label>
          <input matInput type="date" [(ngModel)]="availabilityForm.date" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="availabilityForm.status">
            @for (status of statuses; track status) {
              <mat-option [value]="status">{{ availabilityLabels[status] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Minutes available</mat-label>
          <input matInput type="number" [(ngModel)]="availabilityForm.availableMinutes" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="grow">
          <mat-label>Note</mat-label>
          <input matInput [(ngModel)]="availabilityForm.note" placeholder="Optional" />
        </mat-form-field>
      </div>
      <button mat-flat-button color="primary" [disabled]="!availabilityForm.userId || !availabilityForm.date" (click)="setAvailability()">
        Save
      </button>

      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>From</mat-label>
          <input matInput type="date" [(ngModel)]="from" (change)="loadAll()" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>To</mat-label>
          <input matInput type="date" [(ngModel)]="to" (change)="loadAll()" />
        </mat-form-field>
      </div>
      <table mat-table [dataSource]="availabilityRows()" class="mat-elevation-z0">
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Date</th>
          <td mat-cell *matCellDef="let r">{{ r.date | slice: 0 : 10 }}</td>
        </ng-container>
        <ng-container matColumnDef="technician">
          <th mat-header-cell *matHeaderCellDef>Technician</th>
          <td mat-cell *matCellDef="let r">{{ r.user.firstName }} {{ r.user.lastName }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let r">{{ statusLabel(r.status) }}</td>
        </ng-container>
        <ng-container matColumnDef="minutes">
          <th mat-header-cell *matHeaderCellDef>Minutes</th>
          <td mat-cell *matCellDef="let r">{{ r.availableMinutes }}</td>
        </ng-container>
        <ng-container matColumnDef="note">
          <th mat-header-cell *matHeaderCellDef>Note</th>
          <td mat-cell *matCellDef="let r">{{ r.note }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="availabilityColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: availabilityColumns"></tr>
      </table>
      @if (!availabilityRows().length) {
        <p class="hint">No exceptions recorded in this range — every skilled technician defaults to a standard day.</p>
      }
    </mat-card>

    <mat-card class="section">
      <h3>Capacity by job category</h3>
      <p class="hint">Skilled + available technician hours vs. booked job-card hours, per category per day.</p>
      <table mat-table [dataSource]="capacityRows()" class="mat-elevation-z0">
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Date</th>
          <td mat-cell *matCellDef="let r">{{ r.date }}</td>
        </ng-container>
        <ng-container matColumnDef="category">
          <th mat-header-cell *matHeaderCellDef>Category</th>
          <td mat-cell *matCellDef="let r">{{ categoryLabel(r.category) }}</td>
        </ng-container>
        <ng-container matColumnDef="booked">
          <th mat-header-cell *matHeaderCellDef>Booked</th>
          <td mat-cell *matCellDef="let r">{{ formatMinutes(r.bookedMinutes) }}</td>
        </ng-container>
        <ng-container matColumnDef="capacity">
          <th mat-header-cell *matHeaderCellDef>Capacity</th>
          <td mat-cell *matCellDef="let r">{{ r.capacityMinutes ? formatMinutes(r.capacityMinutes) : 'No skilled techs' }}</td>
        </ng-container>
        <ng-container matColumnDef="utilisation">
          <th mat-header-cell *matHeaderCellDef>Utilisation</th>
          <td mat-cell *matCellDef="let r">
            @if (r.utilisationPct !== null) {
              <span [class.over]="r.utilisationPct > 100">{{ r.utilisationPct }}%</span>
            } @else {
              <span class="hint">—</span>
            }
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="capacityColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: capacityColumns"></tr>
      </table>
      @if (!capacityRows().length) {
        <p class="hint">No booked jobs or skilled technicians in this date range.</p>
      }
    </mat-card>
  `,
  styles: [
    `
      .header {
        margin-bottom: 12px;
      }
      .section {
        padding: 16px;
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: flex-start;
      }
      .grow {
        flex: 1;
        min-width: 160px;
      }
      .tech-row {
        border-bottom: 1px solid #eee;
        padding: 8px 0;
      }
      .tech-name {
        font-weight: 600;
        display: block;
        margin-bottom: 4px;
      }
      .skill-checks {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      .hint {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.55);
      }
      .over {
        color: #c62828;
        font-weight: 600;
      }
      table {
        width: 100%;
      }
    `,
  ],
})
export class TechniciansComponent implements OnInit {
  readonly technicians = signal<Technician[]>([]);
  readonly availabilityRows = signal<AvailabilityRow[]>([]);
  readonly capacityRows = signal<CapacityRow[]>([]);

  readonly categories = Object.values(JobCategory);
  readonly statuses = Object.values(TechnicianAvailabilityStatus);
  readonly categoryLabels = JOB_CATEGORY_LABELS;
  readonly availabilityLabels = TECHNICIAN_AVAILABILITY_LABELS;
  readonly availabilityColumns = ['date', 'technician', 'status', 'minutes', 'note'];
  readonly capacityColumns = ['date', 'category', 'booked', 'capacity', 'utilisation'];

  from = new Date().toISOString().slice(0, 10);
  to = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  availabilityForm = {
    userId: '',
    date: new Date().toISOString().slice(0, 10),
    status: TechnicianAvailabilityStatus.AVAILABLE,
    availableMinutes: 480,
    note: '',
  };

  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.loadTechnicians();
    this.loadAll();
  }

  loadTechnicians(): void {
    this.http.get<Technician[]>(`${environment.apiUrl}/technicians`).subscribe((data) => this.technicians.set(data));
  }

  loadAll(): void {
    this.http
      .get<AvailabilityRow[]>(`${environment.apiUrl}/technicians/availability`, { params: { from: this.from, to: this.to } })
      .subscribe((data) => this.availabilityRows.set(data));
    this.http
      .get<CapacityRow[]>(`${environment.apiUrl}/technicians/capacity-report`, { params: { from: this.from, to: this.to } })
      .subscribe((data) => this.capacityRows.set(data));
  }

  statusLabel(status: TechnicianAvailabilityStatus): string {
    return this.availabilityLabels[status];
  }

  categoryLabel(category: JobCategory): string {
    return this.categoryLabels[category];
  }

  hasSkill(tech: Technician, category: JobCategory): boolean {
    return tech.technicianSkills.some((s) => s.category === category);
  }

  toggleSkill(tech: Technician, category: JobCategory, checked: boolean): void {
    const current = tech.technicianSkills.map((s) => s.category);
    const next = checked ? [...current, category] : current.filter((c) => c !== category);
    this.http
      .put<{ category: JobCategory }[]>(`${environment.apiUrl}/technicians/${tech.id}/skills`, { categories: next })
      .subscribe({
        next: () => this.loadTechnicians(),
        error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not update skills', 'Dismiss', { duration: 4000 }),
      });
  }

  setAvailability(): void {
    this.http.post(`${environment.apiUrl}/technicians/availability`, this.availabilityForm).subscribe({
      next: () => {
        this.availabilityForm.note = '';
        this.loadAll();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not save availability', 'Dismiss', { duration: 4000 }),
    });
  }

  formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  }
}

import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';

import { environment } from '../../../environments/environment';

interface UsedVehicle {
  id: string;
  reg: string;
  make: string;
  model: string;
  mileage: number | null;
  askingPrice: number | null;
  status: string;
}

interface DvlaVehicleSpec {
  make: string;
  colour: string;
  fuelType: string;
  transmission: string;
  yearOfManufacture: number;
}

@Component({
  selector: 'app-used-cars-list',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="header">
      <h1>Used Car Stock</h1>
      <button mat-flat-button color="primary" (click)="showForm.set(!showForm())">
        <mat-icon>add</mat-icon>
        Add vehicle
      </button>
    </div>

    @if (showForm()) {
      <mat-card class="form-card">
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Registration</mat-label>
            <input matInput [(ngModel)]="form.reg" placeholder="NN71 XYZ" />
          </mat-form-field>
          <button mat-stroked-button [disabled]="!form.reg || dvlaLoading()" (click)="lookupDvla()">
            <mat-icon>search</mat-icon>
            Look up on DVLA
          </button>
        </div>
        @if (dvlaResult(); as d) {
          <p class="dvla-hint">
            DVLA says: {{ d.make }}, {{ d.colour }}, {{ d.fuelType }}, {{ d.transmission }}, {{ d.yearOfManufacture }}
          </p>
        }
        <div class="row">
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
            <mat-label>Colour</mat-label>
            <input matInput [(ngModel)]="form.colour" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Mileage</mat-label>
            <input matInput type="number" [(ngModel)]="form.mileage" />
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Purchase price (£)</mat-label>
            <input matInput type="number" [(ngModel)]="form.purchasePrice" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Asking price (£)</mat-label>
            <input matInput type="number" [(ngModel)]="form.askingPrice" />
          </mat-form-field>
        </div>
        <button mat-flat-button color="primary" [disabled]="!form.reg || !form.make || !form.model" (click)="create()">
          Save to stock
        </button>
      </mat-card>
    }

    <div class="grid">
      @for (v of vehicles(); track v.id) {
        <mat-card [routerLink]="['/used-cars', v.id]" class="clickable">
          <div class="reg">{{ v.reg }}</div>
          <div class="model">{{ v.make }} {{ v.model }}</div>
          @if (v.mileage) {
            <div class="mileage">{{ v.mileage | number }} miles</div>
          }
          <div class="price">{{ v.askingPrice | currency: 'GBP' }}</div>
          <mat-chip-set><mat-chip>{{ v.status }}</mat-chip></mat-chip-set>
        </mat-card>
      }
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
      .form-card {
        padding: 16px;
        margin-bottom: 16px;
        max-width: 600px;
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
      .dvla-hint {
        font-size: 12px;
        color: #2e7d32;
        margin: 0;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 16px;
      }
      mat-card {
        padding: 16px;
      }
      .clickable {
        cursor: pointer;
      }
      .reg {
        font-size: 11px;
        color: rgba(0, 0, 0, 0.5);
      }
      .model {
        font-weight: 600;
      }
      .mileage,
      .price {
        font-size: 13px;
        margin-top: 4px;
      }
    `,
  ],
})
export class UsedCarsListComponent implements OnInit {
  readonly vehicles = signal<UsedVehicle[]>([]);
  readonly showForm = signal(false);
  readonly dvlaLoading = signal(false);
  readonly dvlaResult = signal<DvlaVehicleSpec | null>(null);

  form = {
    reg: '',
    make: '',
    model: '',
    colour: '',
    mileage: null as number | null,
    purchasePrice: null as number | null,
    askingPrice: null as number | null,
  };

  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.http.get<UsedVehicle[]>(`${environment.apiUrl}/used-vehicles`).subscribe((data) => this.vehicles.set(data));
  }

  lookupDvla(): void {
    this.dvlaLoading.set(true);
    this.http.get<DvlaVehicleSpec>(`${environment.apiUrl}/used-vehicles/dvla-lookup/${this.form.reg}`).subscribe({
      next: (spec) => {
        this.dvlaResult.set(spec);
        this.form.make = spec.make;
        this.form.colour = spec.colour;
        this.dvlaLoading.set(false);
      },
      error: () => {
        this.dvlaLoading.set(false);
        this.snackBar.open('DVLA lookup failed for that registration', 'Dismiss', { duration: 3000 });
      },
    });
  }

  create(): void {
    this.http.post(`${environment.apiUrl}/used-vehicles`, this.form).subscribe(() => {
      this.showForm.set(false);
      this.dvlaResult.set(null);
      this.form = { reg: '', make: '', model: '', colour: '', mileage: null, purchasePrice: null, askingPrice: null };
      this.load();
    });
  }
}

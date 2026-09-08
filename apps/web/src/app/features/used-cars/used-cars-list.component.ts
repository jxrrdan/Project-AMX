import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';

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

@Component({
  selector: 'app-used-cars-list',
  imports: [CurrencyPipe, DecimalPipe, MatCardModule, MatChipsModule],
  template: `
    <h1>Used Car Stock</h1>
    <div class="grid">
      @for (v of vehicles(); track v.id) {
        <mat-card>
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

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.http.get<UsedVehicle[]>(`${environment.apiUrl}/used-vehicles`).subscribe((data) => this.vehicles.set(data));
  }
}

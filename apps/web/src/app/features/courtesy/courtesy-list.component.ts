import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { environment } from '../../../environments/environment';

interface CourtesyVehicle {
  id: string;
  reg: string;
  make: string;
  model: string;
  status: string;
}

@Component({
  selector: 'app-courtesy-list',
  imports: [MatCardModule, MatChipsModule],
  template: `
    <h1>Courtesy &amp; Loan Car Fleet</h1>
    <div class="grid">
      @for (v of fleet(); track v.id) {
        <mat-card>
          <div class="reg">{{ v.reg }}</div>
          <div class="model">{{ v.make }} {{ v.model }}</div>
          <mat-chip-set><mat-chip>{{ v.status }}</mat-chip></mat-chip-set>
        </mat-card>
      }
    </div>
  `,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
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
    `,
  ],
})
export class CourtesyListComponent implements OnInit {
  readonly fleet = signal<CourtesyVehicle[]>([]);

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.http.get<CourtesyVehicle[]>(`${environment.apiUrl}/courtesy-fleet/vehicles`).subscribe((data) => this.fleet.set(data));
  }
}

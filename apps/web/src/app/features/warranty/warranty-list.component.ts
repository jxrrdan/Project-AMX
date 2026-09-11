import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { environment } from '../../../environments/environment';

interface WarrantyClaim {
  id: string;
  customerName: string;
  faultDescription: string;
  status: string;
  vehicle: { vin: string; model: string };
  operationLines: unknown[];
}

interface VehicleOption {
  id: string;
  vin: string;
  model: string;
}

@Component({
  selector: 'app-warranty-list',
  imports: [RouterLink, FormsModule, MatTableModule, MatChipsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <div class="header">
      <h1>Warranty Claims</h1>
      <button mat-flat-button color="primary" (click)="showForm.set(!showForm())">
        <mat-icon>add</mat-icon>
        New claim
      </button>
    </div>

    @if (showForm()) {
      <div class="form-card">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Vehicle</mat-label>
          <mat-select [(ngModel)]="form.vehicleId">
            @for (v of vehicles(); track v.id) {
              <mat-option [value]="v.id">{{ v.model }} ({{ v.vin }})</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Customer name</mat-label>
          <input matInput [(ngModel)]="form.customerName" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Fault description</mat-label>
          <textarea matInput rows="2" [(ngModel)]="form.faultDescription"></textarea>
        </mat-form-field>
        <button mat-flat-button color="primary" [disabled]="!form.vehicleId || !form.customerName" (click)="create()">
          Create claim
        </button>
      </div>
    }

    <table mat-table [dataSource]="claims()" class="mat-elevation-z1">
      <ng-container matColumnDef="vehicle">
        <th mat-header-cell *matHeaderCellDef>Vehicle</th>
        <td mat-cell *matCellDef="let c"><a [routerLink]="['/warranty', c.id]">{{ c.vehicle.model }} ({{ c.vehicle.vin }})</a></td>
      </ng-container>
      <ng-container matColumnDef="customer">
        <th mat-header-cell *matHeaderCellDef>Customer</th>
        <td mat-cell *matCellDef="let c">{{ c.customerName }}</td>
      </ng-container>
      <ng-container matColumnDef="fault">
        <th mat-header-cell *matHeaderCellDef>Fault</th>
        <td mat-cell *matCellDef="let c">{{ c.faultDescription }}</td>
      </ng-container>
      <ng-container matColumnDef="lines">
        <th mat-header-cell *matHeaderCellDef>Op. Lines</th>
        <td mat-cell *matCellDef="let c">{{ c.operationLines.length }}</td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Status</th>
        <td mat-cell *matCellDef="let c"><mat-chip>{{ c.status }}</mat-chip></td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
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
        max-width: 500px;
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .full-width {
        width: 100%;
      }
      table {
        width: 100%;
      }
      a {
        color: #0066b1;
        text-decoration: none;
      }
    `,
  ],
})
export class WarrantyListComponent implements OnInit {
  readonly claims = signal<WarrantyClaim[]>([]);
  readonly vehicles = signal<VehicleOption[]>([]);
  readonly columns = ['vehicle', 'customer', 'fault', 'lines', 'status'];
  readonly showForm = signal(false);

  form = { vehicleId: '', customerName: '', faultDescription: '' };

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
    this.http.get<VehicleOption[]>(`${environment.apiUrl}/vehicles`).subscribe((data) => this.vehicles.set(data));
  }

  load(): void {
    this.http.get<WarrantyClaim[]>(`${environment.apiUrl}/warranty-claims`).subscribe((data) => this.claims.set(data));
  }

  create(): void {
    this.http.post(`${environment.apiUrl}/warranty-claims`, this.form).subscribe(() => {
      this.showForm.set(false);
      this.form = { vehicleId: '', customerName: '', faultDescription: '' };
      this.load();
    });
  }
}

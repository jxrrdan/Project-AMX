import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { environment } from '../../../environments/environment';

interface WarrantyClaim {
  id: string;
  customerName: string;
  faultDescription: string;
  status: string;
  vehicle: { vin: string; model: string };
  operationLines: unknown[];
}

@Component({
  selector: 'app-warranty-list',
  imports: [MatTableModule, MatChipsModule],
  template: `
    <h1>Warranty Claims</h1>
    <table mat-table [dataSource]="claims()" class="mat-elevation-z1">
      <ng-container matColumnDef="vehicle">
        <th mat-header-cell *matHeaderCellDef>Vehicle</th>
        <td mat-cell *matCellDef="let c">{{ c.vehicle.model }} ({{ c.vehicle.vin }})</td>
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
  styles: [`table { width: 100%; }`],
})
export class WarrantyListComponent implements OnInit {
  readonly claims = signal<WarrantyClaim[]>([]);
  readonly columns = ['vehicle', 'customer', 'fault', 'lines', 'status'];

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.http.get<WarrantyClaim[]>(`${environment.apiUrl}/warranty-claims`).subscribe((data) => this.claims.set(data));
  }
}

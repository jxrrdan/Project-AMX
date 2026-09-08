import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { environment } from '../../../environments/environment';

interface Part {
  id: string;
  partNumber: string;
  description: string;
  binLocation: string | null;
  quantityOnHand: number;
  reorderLevel: number;
  costPrice: number;
}

@Component({
  selector: 'app-parts-list',
  imports: [CurrencyPipe, MatTableModule, MatChipsModule],
  template: `
    <h1>Parts Stock</h1>
    <table mat-table [dataSource]="parts()" class="mat-elevation-z1">
      <ng-container matColumnDef="partNumber">
        <th mat-header-cell *matHeaderCellDef>Part Number</th>
        <td mat-cell *matCellDef="let p">{{ p.partNumber }}</td>
      </ng-container>
      <ng-container matColumnDef="description">
        <th mat-header-cell *matHeaderCellDef>Description</th>
        <td mat-cell *matCellDef="let p">{{ p.description }}</td>
      </ng-container>
      <ng-container matColumnDef="bin">
        <th mat-header-cell *matHeaderCellDef>Bin</th>
        <td mat-cell *matCellDef="let p">{{ p.binLocation }}</td>
      </ng-container>
      <ng-container matColumnDef="qty">
        <th mat-header-cell *matHeaderCellDef>On Hand</th>
        <td mat-cell *matCellDef="let p">
          <mat-chip [class.low]="p.quantityOnHand <= p.reorderLevel">{{ p.quantityOnHand }}</mat-chip>
        </td>
      </ng-container>
      <ng-container matColumnDef="cost">
        <th mat-header-cell *matHeaderCellDef>Cost</th>
        <td mat-cell *matCellDef="let p">{{ p.costPrice | currency: 'GBP' }}</td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
  `,
  styles: [
    `
      table {
        width: 100%;
      }
      .low {
        background: #ffcdd2;
      }
    `,
  ],
})
export class PartsListComponent implements OnInit {
  readonly parts = signal<Part[]>([]);
  readonly columns = ['partNumber', 'description', 'bin', 'qty', 'cost'];

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.http.get<Part[]>(`${environment.apiUrl}/parts`).subscribe((data) => this.parts.set(data));
  }
}

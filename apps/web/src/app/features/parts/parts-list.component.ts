import { CurrencyPipe } from '@angular/common';
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
  imports: [
    CurrencyPipe,
    RouterLink,
    FormsModule,
    MatTableModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="header">
      <h1>Parts Stock</h1>
      <div class="actions">
        <a mat-stroked-button routerLink="/parts/purchase-orders">
          <mat-icon>local_shipping</mat-icon>
          Purchase orders
        </a>
        <button mat-flat-button color="primary" (click)="showForm.set(!showForm())">
          <mat-icon>add</mat-icon>
          Add part
        </button>
      </div>
    </div>

    @if (showForm()) {
      <div class="form-card">
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Part number</mat-label>
            <input matInput [(ngModel)]="form.partNumber" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Description</mat-label>
            <input matInput [(ngModel)]="form.description" />
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Bin location</mat-label>
            <input matInput [(ngModel)]="form.binLocation" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Qty on hand</mat-label>
            <input matInput type="number" [(ngModel)]="form.quantityOnHand" />
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Reorder level</mat-label>
            <input matInput type="number" [(ngModel)]="form.reorderLevel" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Cost price (£)</mat-label>
            <input matInput type="number" [(ngModel)]="form.costPrice" />
          </mat-form-field>
        </div>
        <button mat-flat-button color="primary" [disabled]="!form.partNumber || !form.description" (click)="create()">
          Save
        </button>
      </div>
    }

    <table mat-table [dataSource]="parts()" class="mat-elevation-z1">
      <ng-container matColumnDef="partNumber">
        <th mat-header-cell *matHeaderCellDef>Part Number</th>
        <td mat-cell *matCellDef="let p"><a [routerLink]="['/parts', p.id]">{{ p.partNumber }}</a></td>
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
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .actions {
        display: flex;
        gap: 8px;
      }
      .form-card {
        max-width: 600px;
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
      table {
        width: 100%;
      }
      .low {
        background: #ffcdd2;
      }
      a {
        color: #0066b1;
        text-decoration: none;
      }
    `,
  ],
})
export class PartsListComponent implements OnInit {
  readonly parts = signal<Part[]>([]);
  readonly columns = ['partNumber', 'description', 'bin', 'qty', 'cost'];
  readonly showForm = signal(false);

  form = {
    partNumber: '',
    description: '',
    binLocation: '',
    quantityOnHand: null as number | null,
    reorderLevel: null as number | null,
    costPrice: null as number | null,
  };

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.http.get<Part[]>(`${environment.apiUrl}/parts`).subscribe((data) => this.parts.set(data));
  }

  create(): void {
    this.http.post(`${environment.apiUrl}/parts`, this.form).subscribe(() => {
      this.showForm.set(false);
      this.form = { partNumber: '', description: '', binLocation: '', quantityOnHand: null, reorderLevel: null, costPrice: null };
      this.load();
    });
  }
}

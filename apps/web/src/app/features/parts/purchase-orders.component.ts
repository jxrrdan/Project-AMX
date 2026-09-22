import { CurrencyPipe } from '@angular/common';
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
import { MatSelectModule } from '@angular/material/select';
import { environment } from '../../../environments/environment';

interface PoLine {
  id: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  part: { partNumber: string; description: string };
}

interface Supplier {
  id: string;
  name: string;
}

interface PurchaseOrder {
  id: string;
  supplier: Supplier;
  status: string;
  lines: PoLine[];
}

@Component({
  selector: 'app-purchase-orders',
  imports: [CurrencyPipe, RouterLink, FormsModule, MatCardModule, MatChipsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <div class="header">
      <h1>Purchase Orders</h1>
      <a mat-stroked-button routerLink="/parts">
        <mat-icon>inventory_2</mat-icon>
        Parts catalogue
      </a>
    </div>

    <mat-card class="generate-card">
      <h3>Generate a suggested order from parts at/below reorder level</h3>
      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>Supplier</mat-label>
          <mat-select [(ngModel)]="supplierId">
            @for (s of suppliers(); track s.id) {
              <mat-option [value]="s.id">{{ s.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <button mat-flat-button color="primary" [disabled]="!supplierId" (click)="generate()">Generate suggested PO</button>
      </div>
    </mat-card>

    @for (po of orders(); track po.id) {
      <mat-card class="po-card">
        <div class="po-header">
          <span class="supplier">{{ po.supplier.name }}</span>
          <mat-chip>{{ po.status }}</mat-chip>
          @if (po.status === 'DRAFT') {
            <button mat-button (click)="send(po.id)">Send to supplier</button>
          }
        </div>
        @for (line of po.lines; track line.id) {
          <div class="line-item">
            <span>{{ line.part.partNumber }} — {{ line.part.description }}</span>
            <span>{{ line.quantityReceived }} / {{ line.quantityOrdered }} received</span>
            <span>{{ line.unitCost | currency: 'GBP' }}</span>
            @if (line.quantityReceived < line.quantityOrdered) {
              <button mat-button (click)="receive(line)">Receive stock</button>
            }
          </div>
        }
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
      .generate-card,
      .po-card {
        padding: 16px;
        margin-bottom: 16px;
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .po-header {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 8px;
      }
      .supplier {
        font-weight: 600;
      }
      .line-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        border-bottom: 1px solid #eee;
        padding: 8px 0;
        font-size: 13px;
      }
    `,
  ],
})
export class PurchaseOrdersComponent implements OnInit {
  readonly orders = signal<PurchaseOrder[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  supplierId = '';

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
    this.http.get<Supplier[]>(`${environment.apiUrl}/suppliers`).subscribe((data) => this.suppliers.set(data));
  }

  load(): void {
    this.http.get<PurchaseOrder[]>(`${environment.apiUrl}/purchase-orders`).subscribe((data) => this.orders.set(data));
  }

  generate(): void {
    this.http.post(`${environment.apiUrl}/purchase-orders/suggested`, { supplierId: this.supplierId }).subscribe(() => {
      this.supplierId = '';
      this.load();
    });
  }

  send(id: string): void {
    this.http.post(`${environment.apiUrl}/purchase-orders/${id}/send`, {}).subscribe(() => this.load());
  }

  receive(line: PoLine): void {
    const remaining = line.quantityOrdered - line.quantityReceived;
    this.http
      .post(`${environment.apiUrl}/purchase-order-lines/${line.id}/receive`, { quantityReceived: remaining })
      .subscribe(() => this.load());
  }
}

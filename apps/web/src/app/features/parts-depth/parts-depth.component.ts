import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { BACKORDER_STATUS_LABELS, BackorderStatus } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface Supplier { id: string; name: string; accountRef: string | null; active: boolean; _count?: { priceItems: number }; }
interface StockCount { id: string; reference: string; status: string; createdAt: string; _count?: { lines: number }; }
interface PartOption { id: string; partNumber: string; description: string; }
interface Backorder { id: string; quantity: number; status: BackorderStatus; expectedDate: string | null; part?: { partNumber: string; description: string }; }

@Component({
  selector: 'app-parts-depth',
  imports: [DatePipe, FormsModule, RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatTableModule],
  template: `
    <h1>Parts — Suppliers, Stock Takes & Backorders</h1>

    <mat-card class="section">
      <div class="col-head"><h3>Suppliers</h3><button mat-stroked-button (click)="showSupplierForm.set(!showSupplierForm())"><mat-icon>add</mat-icon></button></div>
      @if (showSupplierForm()) {
        <div class="form-row">
          <mat-form-field appearance="outline"><mat-label>Name</mat-label><input matInput [(ngModel)]="supplierForm.name" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Account ref</mat-label><input matInput [(ngModel)]="supplierForm.accountRef" /></mat-form-field>
          <button mat-flat-button color="primary" [disabled]="!supplierForm.name" (click)="createSupplier()">Add</button>
        </div>
      }
      <table mat-table [dataSource]="suppliers()" class="mat-elevation-z1">
        <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Name</th><td mat-cell *matCellDef="let s">{{ s.name }}</td></ng-container>
        <ng-container matColumnDef="account"><th mat-header-cell *matHeaderCellDef>Account</th><td mat-cell *matCellDef="let s">{{ s.accountRef || '—' }}</td></ng-container>
        <ng-container matColumnDef="items"><th mat-header-cell *matHeaderCellDef>Price items</th><td mat-cell *matCellDef="let s">{{ s._count?.priceItems || 0 }}</td></ng-container>
        <tr mat-header-row *matHeaderRowDef="supplierColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: supplierColumns"></tr>
      </table>
      @if (!suppliers().length) { <p class="empty">No suppliers yet.</p> }
    </mat-card>

    <mat-card class="section">
      <div class="col-head"><h3>Stock takes</h3><button mat-stroked-button (click)="showCountForm.set(!showCountForm())"><mat-icon>add</mat-icon></button></div>
      @if (showCountForm()) {
        <div class="form-row">
          <mat-form-field appearance="outline"><mat-label>Reference</mat-label><input matInput [(ngModel)]="countRef" placeholder="e.g. Q3 full count" /></mat-form-field>
          <button mat-flat-button color="primary" [disabled]="!countRef" (click)="createCount()">Start count</button>
        </div>
      }
      <table mat-table [dataSource]="stockCounts()" class="mat-elevation-z1">
        <ng-container matColumnDef="reference"><th mat-header-cell *matHeaderCellDef>Reference</th><td mat-cell *matCellDef="let c"><a [routerLink]="['/parts/stock-counts', c.id]">{{ c.reference }}</a></td></ng-container>
        <ng-container matColumnDef="lines"><th mat-header-cell *matHeaderCellDef>Lines</th><td mat-cell *matCellDef="let c">{{ c._count?.lines || 0 }}</td></ng-container>
        <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Status</th><td mat-cell *matCellDef="let c"><mat-chip>{{ c.status }}</mat-chip></td></ng-container>
        <ng-container matColumnDef="created"><th mat-header-cell *matHeaderCellDef>Created</th><td mat-cell *matCellDef="let c">{{ c.createdAt | date: 'shortDate' }}</td></ng-container>
        <tr mat-header-row *matHeaderRowDef="countColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: countColumns"></tr>
      </table>
      @if (!stockCounts().length) { <p class="empty">No stock takes yet.</p> }
    </mat-card>

    <mat-card class="section">
      <div class="col-head"><h3>Backorders</h3><button mat-stroked-button (click)="showBackorderForm.set(!showBackorderForm())"><mat-icon>add</mat-icon></button></div>
      @if (showBackorderForm()) {
        <div class="form-row">
          <mat-form-field appearance="outline"><mat-label>Part</mat-label><mat-select [(ngModel)]="backorderForm.partId">@for (p of parts(); track p.id) { <mat-option [value]="p.id">{{ p.partNumber }} — {{ p.description }}</mat-option> }</mat-select></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Qty</mat-label><input matInput type="number" [(ngModel)]="backorderForm.quantity" /></mat-form-field>
          <button mat-flat-button color="primary" [disabled]="!backorderForm.partId || !backorderForm.quantity" (click)="createBackorder()">Add</button>
        </div>
      }
      <table mat-table [dataSource]="backorders()" class="mat-elevation-z1">
        <ng-container matColumnDef="part"><th mat-header-cell *matHeaderCellDef>Part</th><td mat-cell *matCellDef="let b">{{ b.part?.partNumber }} — {{ b.part?.description }}</td></ng-container>
        <ng-container matColumnDef="qty"><th mat-header-cell *matHeaderCellDef>Qty</th><td mat-cell *matCellDef="let b">{{ b.quantity }}</td></ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let b">
            <mat-form-field appearance="outline" class="status-select" subscriptSizing="dynamic">
              <mat-select [ngModel]="b.status" (ngModelChange)="setBackorderStatus(b, $event)">
                @for (s of backorderStatuses; track s) { <mat-option [value]="s">{{ backorderLabels[s] }}</mat-option> }
              </mat-select>
            </mat-form-field>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="backorderColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: backorderColumns"></tr>
      </table>
      @if (!backorders().length) { <p class="empty">No backorders.</p> }
    </mat-card>
  `,
  styles: [`
    .section { padding: 16px; margin-bottom: 16px; }
    .col-head { display: flex; justify-content: space-between; align-items: center; }
    .form-row { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
    .form-row mat-form-field { flex: 1; }
    table { width: 100%; }
    a { color: #0066b1; text-decoration: none; }
    .status-select { width: 150px; }
    .empty { color: var(--amx-text-tertiary); }
  `],
})
export class PartsDepthComponent implements OnInit {
  readonly suppliers = signal<Supplier[]>([]);
  readonly stockCounts = signal<StockCount[]>([]);
  readonly backorders = signal<Backorder[]>([]);
  readonly parts = signal<PartOption[]>([]);
  readonly showSupplierForm = signal(false);
  readonly showCountForm = signal(false);
  readonly showBackorderForm = signal(false);
  readonly supplierColumns = ['name', 'account', 'items'];
  readonly countColumns = ['reference', 'lines', 'status', 'created'];
  readonly backorderColumns = ['part', 'qty', 'status'];
  readonly backorderStatuses = Object.values(BackorderStatus);
  readonly backorderLabels = BACKORDER_STATUS_LABELS;

  supplierForm = { name: '', accountRef: '' };
  countRef = '';
  backorderForm = { partId: '', quantity: null as number | null };

  private readonly http = inject(HttpClient);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.http.get<Supplier[]>(`${environment.apiUrl}/suppliers`).subscribe((d) => this.suppliers.set(d));
    this.http.get<StockCount[]>(`${environment.apiUrl}/stock-counts`).subscribe((d) => this.stockCounts.set(d));
    this.http.get<Backorder[]>(`${environment.apiUrl}/part-backorders`).subscribe((d) => this.backorders.set(d));
    this.http.get<PartOption[]>(`${environment.apiUrl}/parts`).subscribe((d) => this.parts.set(d));
  }

  createSupplier(): void {
    this.http.post(`${environment.apiUrl}/suppliers`, { name: this.supplierForm.name, accountRef: this.supplierForm.accountRef || undefined })
      .subscribe(() => { this.supplierForm = { name: '', accountRef: '' }; this.showSupplierForm.set(false); this.load(); });
  }

  createCount(): void {
    this.http.post(`${environment.apiUrl}/stock-counts`, { reference: this.countRef })
      .subscribe(() => { this.countRef = ''; this.showCountForm.set(false); this.load(); });
  }

  createBackorder(): void {
    this.http.post(`${environment.apiUrl}/part-backorders`, { partId: this.backorderForm.partId, quantity: Number(this.backorderForm.quantity) })
      .subscribe(() => { this.backorderForm = { partId: '', quantity: null }; this.showBackorderForm.set(false); this.load(); });
  }

  setBackorderStatus(b: Backorder, status: BackorderStatus): void {
    if (b.status === status) return;
    this.http.patch(`${environment.apiUrl}/part-backorders/${b.id}`, { status }).subscribe(() => this.load());
  }
}

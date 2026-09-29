import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { environment } from '../../../environments/environment';

interface HistoryEntry { id: string; entryType: string; description: string; mileage: number | null; cost: string | null; performedAt: string; reference: string | null; }
interface Lookup {
  vehicleReg: string;
  entries: HistoryEntry[];
  usedVehicle: { id: string; make: string; model: string } | null;
  recalls: { id: string; status: string; campaign: { code: string; title: string; status: string } }[];
}
interface ParcRow { vehicleReg: string; entries: number; lastActivity: string | null; }

@Component({
  selector: 'app-parc',
  imports: [CurrencyPipe, DatePipe, FormsModule, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTableModule],
  template: `
    <h1>Vehicle Parc & Service History</h1>

    <mat-card class="search">
      <mat-form-field appearance="outline" class="reg"><mat-label>Registration</mat-label><input matInput [(ngModel)]="reg" (keyup.enter)="lookup()" placeholder="AB12 CDE" /></mat-form-field>
      <button mat-flat-button color="primary" [disabled]="!reg.trim()" (click)="lookup()"><mat-icon>search</mat-icon> Look up</button>
    </mat-card>

    @if (result(); as r) {
      <mat-card class="section">
        <div class="rec-head">
          <h3>{{ r.vehicleReg }}</h3>
          @if (r.usedVehicle) { <mat-chip>In used stock: {{ r.usedVehicle.make }} {{ r.usedVehicle.model }}</mat-chip> }
          @for (rc of r.recalls; track rc.id) { <mat-chip class="recall">Recall {{ rc.campaign.code }} — {{ rc.status }}</mat-chip> }
        </div>

        <table mat-table [dataSource]="r.entries" class="mat-elevation-z1">
          <ng-container matColumnDef="performedAt"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let e">{{ e.performedAt | date: 'shortDate' }}</td></ng-container>
          <ng-container matColumnDef="type"><th mat-header-cell *matHeaderCellDef>Type</th><td mat-cell *matCellDef="let e"><mat-chip>{{ e.entryType }}</mat-chip></td></ng-container>
          <ng-container matColumnDef="description"><th mat-header-cell *matHeaderCellDef>Description</th><td mat-cell *matCellDef="let e">{{ e.description }}</td></ng-container>
          <ng-container matColumnDef="mileage"><th mat-header-cell *matHeaderCellDef>Mileage</th><td mat-cell *matCellDef="let e">{{ e.mileage ?? '—' }}</td></ng-container>
          <ng-container matColumnDef="cost"><th mat-header-cell *matHeaderCellDef>Cost</th><td mat-cell *matCellDef="let e">{{ e.cost !== null ? (+e.cost | currency: 'GBP') : '—' }}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="entryColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: entryColumns"></tr>
        </table>
        @if (!r.entries.length) { <p class="empty">No service history recorded for this registration.</p> }

        <div class="add">
          <h4>Add history entry</h4>
          <div class="row">
            <mat-form-field appearance="outline"><mat-label>Type</mat-label><input matInput [(ngModel)]="entryForm.entryType" placeholder="SERVICE / MOT / REPAIR" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Date</mat-label><input matInput type="date" [(ngModel)]="entryForm.performedAt" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Mileage</mat-label><input matInput type="number" [(ngModel)]="entryForm.mileage" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Cost (£)</mat-label><input matInput type="number" [(ngModel)]="entryForm.cost" /></mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="full"><mat-label>Description</mat-label><input matInput [(ngModel)]="entryForm.description" /></mat-form-field>
          <button mat-flat-button color="primary" [disabled]="!entryForm.entryType || !entryForm.description || !entryForm.performedAt" (click)="addEntry(r.vehicleReg)">Add entry</button>
        </div>
      </mat-card>
    }

    <mat-card class="section">
      <h3>Known vehicles</h3>
      <table mat-table [dataSource]="parc()" class="mat-elevation-z1">
        <ng-container matColumnDef="reg"><th mat-header-cell *matHeaderCellDef>Registration</th><td mat-cell *matCellDef="let p"><button type="button" class="linkbtn" (click)="reg = p.vehicleReg; lookup()">{{ p.vehicleReg }}</button></td></ng-container>
        <ng-container matColumnDef="entries"><th mat-header-cell *matHeaderCellDef>Entries</th><td mat-cell *matCellDef="let p">{{ p.entries }}</td></ng-container>
        <ng-container matColumnDef="last"><th mat-header-cell *matHeaderCellDef>Last activity</th><td mat-cell *matCellDef="let p">{{ p.lastActivity ? (p.lastActivity | date: 'shortDate') : '—' }}</td></ng-container>
        <tr mat-header-row *matHeaderRowDef="parcColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: parcColumns"></tr>
      </table>
      @if (!parc().length) { <p class="empty">No vehicles in the parc yet.</p> }
    </mat-card>
  `,
  styles: [`
    .search { padding: 16px; margin-bottom: 16px; display: flex; gap: 12px; align-items: center; }
    .search .reg { width: 240px; }
    .section { padding: 16px; margin-bottom: 16px; }
    .rec-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .recall { background: #fff3e0; }
    table { width: 100%; }
    .add { margin-top: 16px; }
    .row { display: flex; gap: 12px; }
    .row mat-form-field { flex: 1; }
    .full { width: 100%; }
    a { color: #0066b1; cursor: pointer; }
    .linkbtn { background: none; border: none; padding: 0; color: #0066b1; cursor: pointer; font: inherit; }
    .empty { color: rgba(0,0,0,0.5); }
  `],
})
export class ParcComponent implements OnInit {
  readonly result = signal<Lookup | null>(null);
  readonly parc = signal<ParcRow[]>([]);
  readonly entryColumns = ['performedAt', 'type', 'description', 'mileage', 'cost'];
  readonly parcColumns = ['reg', 'entries', 'last'];
  reg = '';
  entryForm = { entryType: '', description: '', mileage: null as number | null, cost: null as number | null, performedAt: '' };

  private readonly http = inject(HttpClient);

  ngOnInit(): void { this.loadParc(); }

  loadParc(): void {
    this.http.get<ParcRow[]>(`${environment.apiUrl}/parc`).subscribe((d) => this.parc.set(d));
  }

  lookup(): void {
    if (!this.reg.trim()) return;
    this.http.get<Lookup>(`${environment.apiUrl}/parc/${encodeURIComponent(this.reg.trim())}`).subscribe((d) => this.result.set(d));
  }

  addEntry(vehicleReg: string): void {
    this.http.post(`${environment.apiUrl}/parc/entries`, {
      vehicleReg,
      entryType: this.entryForm.entryType,
      description: this.entryForm.description,
      mileage: this.entryForm.mileage != null ? Number(this.entryForm.mileage) : undefined,
      cost: this.entryForm.cost != null ? Number(this.entryForm.cost) : undefined,
      performedAt: new Date(this.entryForm.performedAt).toISOString(),
    }).subscribe(() => {
      this.entryForm = { entryType: '', description: '', mileage: null, cost: null, performedAt: '' };
      this.lookup();
      this.loadParc();
    });
  }
}

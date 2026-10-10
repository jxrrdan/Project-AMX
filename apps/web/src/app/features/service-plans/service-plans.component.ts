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
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { environment } from '../../../environments/environment';

interface Plan { id: string; name: string; priceMonthly: string; intervalMonths: number; active: boolean; _count?: { subscriptions: number }; }
interface Subscription { id: string; customerName: string; vehicleReg: string; motDueDate: string | null; serviceDueDate: string | null; active: boolean; plan?: { name: string }; }
interface DueSummary { motDue: number; serviceDue: number; }

@Component({
  selector: 'app-service-plans',
  imports: [CurrencyPipe, DatePipe, FormsModule, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatTableModule],
  template: `
    <div class="header">
      <h1>Service Plans & Reminders</h1>
      <div class="actions">
        <button mat-stroked-button (click)="runBilling()"><mat-icon>request_quote</mat-icon> Run billing now</button>
        <button mat-flat-button color="primary" (click)="runReminders()"><mat-icon>notifications_active</mat-icon> Run reminders now</button>
      </div>
    </div>
    <p class="hint">Reminders run automatically every night and billing on the 1st of each month; the buttons above trigger them on demand.</p>

    @if (summary(); as s) {
      <div class="tiles">
        <mat-card class="tile warn"><span class="num">{{ s.motDue }}</span><span>MOT reminders due (30d)</span></mat-card>
        <mat-card class="tile info"><span class="num">{{ s.serviceDue }}</span><span>Service reminders due (30d)</span></mat-card>
      </div>
    }

    <div class="cols">
      <mat-card class="col">
        <div class="col-head"><h3>Plans</h3><button mat-stroked-button (click)="showPlanForm.set(!showPlanForm())"><mat-icon>add</mat-icon></button></div>
        @if (showPlanForm()) {
          <div class="form">
            <mat-form-field appearance="outline"><mat-label>Name</mat-label><input matInput [(ngModel)]="planForm.name" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Price / month (£)</mat-label><input matInput type="number" [(ngModel)]="planForm.priceMonthly" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Interval (months)</mat-label><input matInput type="number" [(ngModel)]="planForm.intervalMonths" /></mat-form-field>
            <button mat-flat-button color="primary" [disabled]="!planForm.name" (click)="createPlan()">Create</button>
          </div>
        }
        @for (p of plans(); track p.id) {
          <div class="line">
            <span>{{ p.name }} · {{ +p.priceMonthly | currency: 'GBP' }}/mo · {{ p._count?.subscriptions || 0 }} subs</span>
            @if (!p.active) { <mat-chip>Inactive</mat-chip> }
          </div>
        }
        @if (!plans().length) { <p class="empty">No plans yet.</p> }
      </mat-card>

      <mat-card class="col">
        <div class="col-head"><h3>Subscriptions</h3><button mat-stroked-button (click)="showSubForm.set(!showSubForm())" [disabled]="!plans().length"><mat-icon>add</mat-icon></button></div>
        @if (showSubForm()) {
          <div class="form">
            <mat-form-field appearance="outline"><mat-label>Plan</mat-label><mat-select [(ngModel)]="subForm.planId">@for (p of plans(); track p.id) { <mat-option [value]="p.id">{{ p.name }}</mat-option> }</mat-select></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Customer</mat-label><input matInput [(ngModel)]="subForm.customerName" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Reg</mat-label><input matInput [(ngModel)]="subForm.vehicleReg" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Email</mat-label><input matInput [(ngModel)]="subForm.contactEmail" /></mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Bill to account (optional)</mat-label>
              <mat-select [(ngModel)]="subForm.accountCustomerId">
                <mat-option [value]="null">— None —</mat-option>
                @for (a of accounts(); track a.id) { <mat-option [value]="a.id">{{ a.name }}</mat-option> }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>MOT due</mat-label><input matInput type="date" [(ngModel)]="subForm.motDueDate" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Service due</mat-label><input matInput type="date" [(ngModel)]="subForm.serviceDueDate" /></mat-form-field>
            <button mat-flat-button color="primary" [disabled]="!subForm.planId || !subForm.customerName || !subForm.vehicleReg" (click)="createSub()">Create</button>
          </div>
        }
        <table mat-table [dataSource]="subscriptions()" class="mat-elevation-z1">
          <ng-container matColumnDef="customer"><th mat-header-cell *matHeaderCellDef>Customer</th><td mat-cell *matCellDef="let s">{{ s.customerName }}</td></ng-container>
          <ng-container matColumnDef="reg"><th mat-header-cell *matHeaderCellDef>Reg</th><td mat-cell *matCellDef="let s">{{ s.vehicleReg }}</td></ng-container>
          <ng-container matColumnDef="mot"><th mat-header-cell *matHeaderCellDef>MOT due</th><td mat-cell *matCellDef="let s">{{ s.motDueDate ? (s.motDueDate | date: 'shortDate') : '—' }}</td></ng-container>
          <ng-container matColumnDef="service"><th mat-header-cell *matHeaderCellDef>Service due</th><td mat-cell *matCellDef="let s">{{ s.serviceDueDate ? (s.serviceDueDate | date: 'shortDate') : '—' }}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="subColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: subColumns"></tr>
        </table>
        @if (!subscriptions().length) { <p class="empty">No subscriptions yet.</p> }
      </mat-card>
    </div>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .header .actions { display: flex; gap: 8px; }
    .hint { color: var(--amx-text-secondary); margin: 0 0 16px; font-size: 13px; }
    .tiles { display: flex; gap: 12px; margin-bottom: 16px; }
    .tile { flex: 0 0 220px; padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; }
    .tile .num { font-size: 26px; font-weight: 600; }
    .tile.warn .num { color: var(--amx-warning-fg); } .tile.info .num { color: var(--amx-info-fg); }
    .cols { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
    .col { flex: 1; min-width: 360px; padding: 16px; }
    .col-head { display: flex; justify-content: space-between; align-items: center; }
    .form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .line { padding: 6px 0; border-bottom: 1px solid var(--amx-border-subtle); display: flex; justify-content: space-between; }
    table { width: 100%; }
    .empty { color: var(--amx-text-tertiary); }
  `],
})
export class ServicePlansComponent implements OnInit {
  readonly plans = signal<Plan[]>([]);
  readonly subscriptions = signal<Subscription[]>([]);
  readonly accounts = signal<{ id: string; name: string }[]>([]);
  readonly summary = signal<DueSummary | null>(null);
  readonly showPlanForm = signal(false);
  readonly showSubForm = signal(false);
  readonly subColumns = ['customer', 'reg', 'mot', 'service'];
  planForm = { name: '', priceMonthly: null as number | null, intervalMonths: 12 };
  subForm = { planId: '', customerName: '', vehicleReg: '', contactEmail: '', accountCustomerId: null as string | null, motDueDate: '', serviceDueDate: '' };

  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.http.get<Plan[]>(`${environment.apiUrl}/service-plans`).subscribe((d) => this.plans.set(d));
    this.http.get<Subscription[]>(`${environment.apiUrl}/service-plans/subscriptions/all`).subscribe((d) => this.subscriptions.set(d));
    this.http.get<DueSummary>(`${environment.apiUrl}/service-plans/reminders/summary`).subscribe((d) => this.summary.set(d));
    this.http.get<{ id: string; name: string }[]>(`${environment.apiUrl}/account-customers?active=true`).subscribe((d) => this.accounts.set(d));
  }

  createPlan(): void {
    this.http.post(`${environment.apiUrl}/service-plans`, {
      name: this.planForm.name,
      priceMonthly: this.planForm.priceMonthly != null ? Number(this.planForm.priceMonthly) : undefined,
      intervalMonths: Number(this.planForm.intervalMonths),
    }).subscribe(() => { this.planForm = { name: '', priceMonthly: null, intervalMonths: 12 }; this.showPlanForm.set(false); this.load(); });
  }

  createSub(): void {
    this.http.post(`${environment.apiUrl}/service-plans/subscriptions`, {
      planId: this.subForm.planId,
      customerName: this.subForm.customerName,
      vehicleReg: this.subForm.vehicleReg,
      contactEmail: this.subForm.contactEmail || undefined,
      accountCustomerId: this.subForm.accountCustomerId || undefined,
      motDueDate: this.subForm.motDueDate ? new Date(this.subForm.motDueDate).toISOString() : undefined,
      serviceDueDate: this.subForm.serviceDueDate ? new Date(this.subForm.serviceDueDate).toISOString() : undefined,
    }).subscribe(() => { this.subForm = { planId: '', customerName: '', vehicleReg: '', contactEmail: '', accountCustomerId: null, motDueDate: '', serviceDueDate: '' }; this.showSubForm.set(false); this.load(); });
  }

  runReminders(): void {
    this.http.post<{ total: number }>(`${environment.apiUrl}/service-plans/reminders/run`, {}).subscribe((r) => {
      this.snackBar.open(`Sent ${r.total} reminder(s)`, 'Dismiss', { duration: 3000 });
      this.load();
    });
  }

  runBilling(): void {
    this.http.post<{ billed: number; total: number }>(`${environment.apiUrl}/service-plans/billing/run`, {}).subscribe((r) => {
      this.snackBar.open(`Billed ${r.billed} subscription(s), £${r.total.toFixed(2)} to AR`, 'Dismiss', { duration: 3500 });
      this.load();
    });
  }
}

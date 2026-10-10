import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { environment } from '../../../environments/environment';

interface Line {
  id: string;
  expectedQty: number;
  countedQty: number | null;
  part: { partNumber: string; description: string; quantityOnHand: number };
}
interface StockCount { id: string; reference: string; status: string; lines: Line[]; }

@Component({
  selector: 'app-stock-count-detail',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTableModule],
  template: `
    @if (count(); as c) {
      <div class="header">
        <button mat-icon-button (click)="back()"><mat-icon>arrow_back</mat-icon></button>
        <span class="title">Stock take — {{ c.reference }}</span>
        <mat-chip>{{ c.status }}</mat-chip>
        <span class="spacer"></span>
        @if (c.status === 'OPEN') {
          <button mat-flat-button color="primary" (click)="complete()"><mat-icon>check</mat-icon> Complete & post variances</button>
        }
      </div>

      <mat-card class="section">
        <table mat-table [dataSource]="c.lines" class="mat-elevation-z1">
          <ng-container matColumnDef="part"><th mat-header-cell *matHeaderCellDef>Part</th><td mat-cell *matCellDef="let l">{{ l.part.partNumber }} — {{ l.part.description }}</td></ng-container>
          <ng-container matColumnDef="expected"><th mat-header-cell *matHeaderCellDef>Expected</th><td mat-cell *matCellDef="let l">{{ l.part.quantityOnHand }}</td></ng-container>
          <ng-container matColumnDef="counted">
            <th mat-header-cell *matHeaderCellDef>Counted</th>
            <td mat-cell *matCellDef="let l">
              @if (c.status === 'OPEN') {
                <mat-form-field appearance="outline" class="qty" subscriptSizing="dynamic">
                  <input matInput type="number" [ngModel]="l.countedQty" (blur)="saveLine(l, $event)" />
                </mat-form-field>
              } @else { {{ l.countedQty ?? '—' }} }
            </td>
          </ng-container>
          <ng-container matColumnDef="variance">
            <th mat-header-cell *matHeaderCellDef>Variance</th>
            <td mat-cell *matCellDef="let l" [class.neg]="variance(l) < 0" [class.pos]="variance(l) > 0">{{ l.countedQty === null ? '—' : variance(l) }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
        @if (!c.lines.length) { <p class="empty">No parts to count.</p> }
      </mat-card>
    }
  `,
  styles: [`
    .header { display: flex; align-items: center; gap: 8px; }
    .title { font-size: 18px; font-weight: 600; }
    .spacer { flex: 1 1 auto; }
    .section { padding: 16px; margin-top: 16px; }
    table { width: 100%; }
    .qty { width: 90px; }
    .neg { color: var(--amx-danger-fg); font-weight: 600; }
    .pos { color: var(--amx-success-fg); font-weight: 600; }
    .empty { color: var(--amx-text-tertiary); }
  `],
})
export class StockCountDetailComponent implements OnInit {
  readonly count = signal<StockCount | null>(null);
  readonly columns = ['part', 'expected', 'counted', 'variance'];
  private id = '';

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.http.get<StockCount>(`${environment.apiUrl}/stock-counts/${this.id}`).subscribe((d) => this.count.set(d));
  }

  variance(l: Line): number {
    return l.countedQty == null ? 0 : l.countedQty - l.part.quantityOnHand;
  }

  saveLine(l: Line, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isNaN(value) || value === l.countedQty) return;
    this.http.patch(`${environment.apiUrl}/stock-count-lines/${l.id}`, { countedQty: value }).subscribe(() => this.load());
  }

  complete(): void {
    this.http.post<{ adjustments: number }>(`${environment.apiUrl}/stock-counts/${this.id}/complete`, {}).subscribe({
      next: (r) => { this.snackBar.open(`Completed — ${r.adjustments} adjustment(s) posted`, 'Dismiss', { duration: 3500 }); this.load(); },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not complete', 'Dismiss', { duration: 4000 }),
    });
  }

  back(): void { this.router.navigate(['/parts/suppliers']); }
}

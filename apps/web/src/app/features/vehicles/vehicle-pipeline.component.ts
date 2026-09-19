import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VEHICLE_PIPELINE_COLUMNS, VehiclePipelineStatus } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface VehicleCard {
  id: string;
  vin: string;
  model: string;
  colour: string | null;
  customerName: string | null;
  eta: string | null;
  status: VehiclePipelineStatus;
  allocatedAdvisor?: { firstName: string; lastName: string } | null;
}

const COLUMN_LABELS: Record<VehiclePipelineStatus, string> = {
  ORDERED: 'Ordered',
  IN_PRODUCTION: 'In Production',
  IN_TRANSIT: 'In Transit',
  ARRIVED: 'Arrived',
  PDI_SCHEDULED: 'PDI Scheduled',
  PDI_COMPLETE: 'PDI Complete',
  READY_FOR_HANDOVER: 'Ready for Handover',
  DELIVERED: 'Delivered',
};

@Component({
  selector: 'app-vehicle-pipeline',
  imports: [DatePipe, DragDropModule, MatCardModule, MatChipsModule, MatButtonModule, MatIconModule],
  template: `
    <div class="header">
      <h1>New Car Stock &amp; PDI Pipeline</h1>
      <button mat-stroked-button (click)="importMockOrder()">
        <mat-icon>add</mat-icon>
        Simulate RIS order
      </button>
    </div>

    <div class="board" cdkDropListGroup>
      @for (column of columns; track column) {
        <div class="column">
          <h3>{{ labels[column] }} <span class="count">{{ byStatus(column).length }}</span></h3>
          <div
            class="drop-list"
            cdkDropList
            [cdkDropListData]="byStatus(column)"
            [id]="column"
            (cdkDropListDropped)="drop($event, column)"
          >
            @for (vehicle of byStatus(column); track vehicle.id) {
              <mat-card class="vehicle-card" cdkDrag>
                <div class="vin">{{ vehicle.vin }}</div>
                <div class="model">{{ vehicle.model }}</div>
                @if (vehicle.colour) {
                  <mat-chip-set><mat-chip>{{ vehicle.colour }}</mat-chip></mat-chip-set>
                }
                @if (vehicle.customerName) {
                  <div class="customer">{{ vehicle.customerName }}</div>
                }
                @if (vehicle.eta) {
                  <div class="eta">ETA {{ vehicle.eta | date: 'd MMM' }}</div>
                }
              </mat-card>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }
      .board {
        display: flex;
        gap: 12px;
        overflow-x: auto;
        padding-bottom: 16px;
      }
      .column {
        min-width: 220px;
        flex: 0 0 220px;
      }
      .column h3 {
        font-size: 13px;
        color: rgba(0, 0, 0, 0.6);
        display: flex;
        justify-content: space-between;
      }
      .count {
        background: #e0e0e0;
        border-radius: 10px;
        padding: 0 8px;
        font-size: 11px;
      }
      .drop-list {
        min-height: 60px;
        background: #eceff1;
        border-radius: 8px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .vehicle-card {
        padding: 12px;
        cursor: grab;
      }
      .vin {
        font-size: 11px;
        color: rgba(0, 0, 0, 0.5);
      }
      .model {
        font-weight: 600;
      }
      .customer,
      .eta {
        font-size: 12px;
        margin-top: 4px;
      }
    `,
  ],
})
export class VehiclePipelineComponent implements OnInit {
  readonly columns = VEHICLE_PIPELINE_COLUMNS;
  readonly labels = COLUMN_LABELS;
  readonly vehicles = signal<VehicleCard[]>([]);

  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.http.get<VehicleCard[]>(`${environment.apiUrl}/vehicles`).subscribe((data) => this.vehicles.set(data));
  }

  byStatus(status: VehiclePipelineStatus): VehicleCard[] {
    return this.vehicles().filter((v) => v.status === status);
  }

  drop(event: CdkDragDrop<VehicleCard[]>, targetColumn: VehiclePipelineStatus): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    const vehicle = event.previousContainer.data[event.previousIndex];
    const sourceIndex = this.columns.indexOf(vehicle.status);
    const targetIndex = this.columns.indexOf(targetColumn);
    if (targetIndex < sourceIndex) {
      this.snackBar.open('Vehicles cannot move backwards through the pipeline', 'Dismiss', { duration: 3000 });
      return;
    }

    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    vehicle.status = targetColumn;

    this.http.patch(`${environment.apiUrl}/vehicles/${vehicle.id}`, { status: targetColumn }).subscribe({
      error: () => {
        this.snackBar.open('Failed to update vehicle status', 'Dismiss', { duration: 3000 });
        this.load();
      },
    });
  }

  importMockOrder(): void {
    this.http.post(`${environment.apiUrl}/vehicles/import-mock-order`, {}).subscribe(() => this.load());
  }
}

import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, transferArrayItem, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LEAD_PIPELINE_COLUMNS, LeadStage } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface Lead {
  id: string;
  stage: LeadStage;
  source: string;
  contact: { firstName: string; lastName: string };
  usedVehicle?: { make: string; model: string } | null;
}

@Component({
  selector: 'app-leads-board',
  imports: [DragDropModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="header">
      <h1>CRM Lead Pipeline</h1>
      <a mat-stroked-button routerLink="/crm/contacts">
        <mat-icon>contacts</mat-icon>
        Contacts
      </a>
    </div>
    <div class="board" cdkDropListGroup>
      @for (stage of stages; track stage) {
        <div class="column">
          <h3>{{ stage }} <span class="count">{{ byStage(stage).length }}</span></h3>
          <div class="drop-list" cdkDropList [cdkDropListData]="byStage(stage)" [id]="stage" (cdkDropListDropped)="drop($event, stage)">
            @for (lead of byStage(stage); track lead.id) {
              <mat-card class="lead-card" cdkDrag>
                <div class="name">{{ lead.contact.firstName }} {{ lead.contact.lastName }}</div>
                @if (lead.usedVehicle) {
                  <div class="vehicle">{{ lead.usedVehicle.make }} {{ lead.usedVehicle.model }}</div>
                }
                <div class="source">{{ lead.source }}</div>
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
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .board {
        display: flex;
        gap: 12px;
        overflow-x: auto;
      }
      .column {
        min-width: 200px;
        flex: 0 0 200px;
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
        min-height: 100px;
        background: #eceff1;
        border-radius: 8px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .lead-card {
        padding: 12px;
        cursor: grab;
      }
      .name {
        font-weight: 600;
      }
      .vehicle,
      .source {
        font-size: 12px;
        margin-top: 4px;
        color: rgba(0, 0, 0, 0.6);
      }
    `,
  ],
})
export class LeadsBoardComponent implements OnInit {
  readonly stages = LEAD_PIPELINE_COLUMNS;
  readonly leads = signal<Lead[]>([]);

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.http.get<Lead[]>(`${environment.apiUrl}/leads`).subscribe((data) => this.leads.set(data));
  }

  byStage(stage: LeadStage): Lead[] {
    return this.leads().filter((l) => l.stage === stage);
  }

  drop(event: CdkDragDrop<Lead[]>, targetStage: LeadStage): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const lead = event.previousContainer.data[event.previousIndex];
    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    lead.stage = targetStage;

    const lostReason = targetStage === LeadStage.LOST ? window.prompt('Reason for losing this lead?') ?? undefined : undefined;
    this.http.patch(`${environment.apiUrl}/leads/${lead.id}/stage`, { stage: targetStage, lostReason }).subscribe({
      error: () => this.load(),
    });
  }
}

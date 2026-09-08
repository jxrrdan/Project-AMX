import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { environment } from '../../../environments/environment';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
}

@Component({
  selector: 'app-contacts-list',
  imports: [FormsModule, RouterLink, MatTableModule, MatChipsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="header">
      <h1>CRM Contacts</h1>
      <a mat-stroked-button routerLink="/crm">
        <mat-icon>view_kanban</mat-icon>
        Lead pipeline
      </a>
    </div>

    <mat-form-field appearance="outline" class="search">
      <mat-label>Search by name, email, or phone</mat-label>
      <input matInput [(ngModel)]="search" (ngModelChange)="load()" />
    </mat-form-field>

    <table mat-table [dataSource]="contacts()" class="mat-elevation-z1">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>Name</th>
        <td mat-cell *matCellDef="let c">
          <a [routerLink]="['/crm/contacts', c.id]">{{ c.firstName }} {{ c.lastName }}</a>
        </td>
      </ng-container>
      <ng-container matColumnDef="email">
        <th mat-header-cell *matHeaderCellDef>Email</th>
        <td mat-cell *matCellDef="let c">{{ c.email }}</td>
      </ng-container>
      <ng-container matColumnDef="phone">
        <th mat-header-cell *matHeaderCellDef>Phone</th>
        <td mat-cell *matCellDef="let c">{{ c.phone }}</td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Status</th>
        <td mat-cell *matCellDef="let c"><mat-chip>{{ c.status }}</mat-chip></td>
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
      .search {
        width: 100%;
        max-width: 400px;
      }
      table {
        width: 100%;
      }
      a {
        color: #0066b1;
        text-decoration: none;
      }
    `,
  ],
})
export class ContactsListComponent implements OnInit {
  readonly contacts = signal<Contact[]>([]);
  readonly columns = ['name', 'email', 'phone', 'status'];
  search = '';

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.http
      .get<Contact[]>(`${environment.apiUrl}/contacts`, { params: this.search ? { search: this.search } : {} })
      .subscribe((data) => this.contacts.set(data));
  }
}

import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';

import { environment } from '../../../environments/environment';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  active: boolean;
  roles: { role: { name: string } }[];
}

@Component({
  selector: 'app-users-list',
  imports: [MatTableModule, MatChipsModule, MatIconModule],
  template: `
    <h1>Users &amp; Roles</h1>
    <table mat-table [dataSource]="users()" class="mat-elevation-z1">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>Name</th>
        <td mat-cell *matCellDef="let u">{{ u.firstName }} {{ u.lastName }}</td>
      </ng-container>
      <ng-container matColumnDef="email">
        <th mat-header-cell *matHeaderCellDef>Email</th>
        <td mat-cell *matCellDef="let u">{{ u.email }}</td>
      </ng-container>
      <ng-container matColumnDef="roles">
        <th mat-header-cell *matHeaderCellDef>Roles</th>
        <td mat-cell *matCellDef="let u">
          @for (r of u.roles; track r.role.name) {
            <mat-chip>{{ r.role.name }}</mat-chip>
          }
        </td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Status</th>
        <td mat-cell *matCellDef="let u">
          <mat-icon [color]="u.active ? 'primary' : 'warn'">{{ u.active ? 'check_circle' : 'cancel' }}</mat-icon>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
  `,
  styles: [`table { width: 100%; }`],
})
export class UsersListComponent implements OnInit {
  readonly users = signal<User[]>([]);
  readonly columns = ['name', 'email', 'roles', 'status'];

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.http.get<User[]>(`${environment.apiUrl}/users`).subscribe((data) => this.users.set(data));
  }
}

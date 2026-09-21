import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth.service';
import { environment } from '../../../environments/environment';

/** Lets a user set their own phone number so SMS notifications (see NotificationsService) have
 * somewhere to go — nothing else in the app can set it, since editing another user's record
 * needs ADMIN permission, and a phone number is personal, not an admin-managed field. */
@Component({
  selector: 'app-my-profile',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  template: `
    <h1>My profile</h1>
    <mat-card class="section">
      <p class="hint">
        Your phone number is used for SMS notifications (e.g. a stale-lead alert) — everything
        else here still shows up in-app and by email regardless.
      </p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Name</mat-label>
        <input matInput [value]="auth.user()?.firstName + ' ' + auth.user()?.lastName" disabled />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Email</mat-label>
        <input matInput [value]="auth.user()?.email" disabled />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Phone (for SMS notifications)</mat-label>
        <input matInput [(ngModel)]="phone" placeholder="+44 7700 900000" />
      </mat-form-field>
      <button mat-flat-button color="primary" (click)="save()">Save</button>
    </mat-card>
  `,
  styles: [
    `
      .section {
        padding: 16px;
        max-width: 480px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .full-width {
        width: 100%;
      }
      .hint {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.55);
      }
    `,
  ],
})
export class MyProfileComponent {
  readonly auth = inject(AuthService);
  phone = '';

  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  save(): void {
    this.http.patch(`${environment.apiUrl}/users/me`, { phone: this.phone || null }).subscribe({
      next: () => this.snackBar.open('Profile saved', 'Dismiss', { duration: 2000 }),
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not save profile', 'Dismiss', { duration: 4000 }),
    });
  }
}

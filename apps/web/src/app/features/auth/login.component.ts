import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <div class="login-page">
      <mat-card class="login-card">
        <h1>AMS</h1>
        <p class="subtitle">Agent Management System — sign in</p>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Dealer subdomain</mat-label>
          <input matInput [(ngModel)]="subdomain" placeholder="bmwnorthampton" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Email</mat-label>
          <input matInput [(ngModel)]="email" type="email" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Password</mat-label>
          <input matInput [(ngModel)]="password" type="password" (keyup.enter)="submit()" />
        </mat-form-field>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <button mat-flat-button color="primary" class="full-width" (click)="submit()" [disabled]="loading()">
          @if (loading()) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            Sign in
          }
        </button>

        <p class="hint">
          Demo: bmwnorthampton / principal&#64;bmwnorthampton.ams-app.co.uk / Password123!
        </p>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .login-page {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: linear-gradient(135deg, #0066b1, #00305a);
      }
      .login-card {
        width: 360px;
        padding: 32px;
      }
      .subtitle {
        color: rgba(0, 0, 0, 0.6);
        margin-top: -8px;
      }
      .full-width {
        width: 100%;
        margin-bottom: 8px;
      }
      .error {
        color: #c62828;
        font-size: 13px;
      }
      .hint {
        font-size: 11px;
        color: rgba(0, 0, 0, 0.5);
        margin-top: 16px;
      }
    `,
  ],
})
export class LoginComponent {
  subdomain = 'bmwnorthampton';
  email = 'principal@bmwnorthampton.ams-app.co.uk';
  password = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async submit(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.auth.login({ subdomain: this.subdomain, email: this.email, password: this.password });
      this.router.navigate(['/dashboard']);
    } catch {
      this.error.set('Invalid subdomain, email, or password.');
    } finally {
      this.loading.set(false);
    }
  }
}

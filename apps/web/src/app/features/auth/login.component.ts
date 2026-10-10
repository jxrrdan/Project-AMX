import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth.service';
import { BmwRoundelComponent } from '../../shared/bmw-roundel.component';

@Component({
  selector: 'app-login',
  imports: [BmwRoundelComponent, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <div class="login-page">
      <mat-card class="login-card">
        <div class="login-head">
          <app-bmw-roundel [size]="64" />
          <div>
            <h1>AMS</h1>
            <p class="subtitle">Agent Management System</p>
          </div>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Agent subdomain</mat-label>
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
        background:
          radial-gradient(1200px 600px at 20% 10%, rgba(28, 105, 212, 0.45), transparent 60%),
          linear-gradient(160deg, #1a1a1a, #000);
      }
      .login-card {
        width: 380px;
        padding: 32px;
        border-top: 3px solid transparent;
        border-image: linear-gradient(90deg, #81c4ff 0 33.4%, #0653b6 33.4% 66.7%, #e7222e 66.7% 100%) 1;
      }
      .login-head {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
      }
      .login-head h1 {
        margin: 0;
        letter-spacing: 0.14em;
        font-weight: 700;
        font-size: 28px;
      }
      .subtitle {
        color: var(--amx-text-secondary);
        margin: 2px 0 0;
        font-size: 13px;
      }
      .full-width {
        width: 100%;
        margin-bottom: 8px;
      }
      .error {
        color: var(--amx-danger-fg);
        font-size: 13px;
      }
      .hint {
        font-size: 11px;
        color: var(--amx-text-tertiary);
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

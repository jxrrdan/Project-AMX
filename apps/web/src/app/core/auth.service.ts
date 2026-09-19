import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { AuthUser, LoginRequest, LoginResponse, ModuleKey, PermissionAction } from '@project-amx/shared';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

const ACCESS_TOKEN_KEY = 'ams.accessToken';
const REFRESH_TOKEN_KEY = 'ams.refreshToken';
const USER_KEY = 'ams.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly userSignal = signal<AuthUser | null>(this.readStoredUser());
  readonly user = computed(() => this.userSignal());
  readonly isAuthenticated = computed(() => !!this.userSignal());

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  async login(request: LoginRequest): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, request),
    );
    this.persistSession(response);
  }

  async refreshSession(): Promise<boolean> {
    const refreshToken = this.refreshToken;
    if (!refreshToken) return false;
    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${environment.apiUrl}/auth/refresh`, { refreshToken }),
      );
      this.persistSession(response);
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  logout(): void {
    const refreshToken = this.refreshToken;
    this.clearSession();
    this.router.navigate(['/login']);
    if (refreshToken) {
      firstValueFrom(this.http.post(`${environment.apiUrl}/auth/logout`, { refreshToken })).catch(() => undefined);
    }
  }

  hasPermission(module: ModuleKey, action: PermissionAction): boolean {
    const user = this.userSignal();
    return !!user?.permissions.some((p) => p.module === module && p.action === action);
  }

  private persistSession(response: LoginResponse): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.userSignal.set(response.user);
  }

  private clearSession(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.userSignal.set(null);
  }

  private readStoredUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}

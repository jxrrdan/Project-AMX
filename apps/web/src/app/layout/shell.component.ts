import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import { AuthService } from '../core/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  module: ModuleKey;
}

const NAV_ITEMS: NavItem[] = [
  { path: 'dashboard', label: 'Dashboard', icon: 'space_dashboard', module: ModuleKey.DASHBOARD },
  { path: 'vehicles', label: 'New Car & PDI', icon: 'directions_car', module: ModuleKey.NEW_CAR_PDI },
  { path: 'workshop', label: 'Workshop', icon: 'build', module: ModuleKey.WORKSHOP },
  { path: 'parts', label: 'Parts', icon: 'inventory_2', module: ModuleKey.PARTS },
  { path: 'used-cars', label: 'Used Cars', icon: 'car_repair', module: ModuleKey.USED_CARS },
  { path: 'warranty', label: 'Warranty', icon: 'verified', module: ModuleKey.WARRANTY },
  { path: 'crm', label: 'CRM', icon: 'contacts', module: ModuleKey.CRM },
  { path: 'vhc', label: 'Vehicle Health Check', icon: 'health_and_safety', module: ModuleKey.VHC },
  { path: 'listings', label: 'Stock Listings', icon: 'storefront', module: ModuleKey.LISTINGS },
  { path: 'accounting', label: 'Accounting', icon: 'receipt_long', module: ModuleKey.ACCOUNTING },
  { path: 'courtesy', label: 'Courtesy Fleet', icon: 'time_to_leave', module: ModuleKey.COURTESY_FLEET },
  { path: 'fi', label: 'Finance & Insurance', icon: 'account_balance', module: ModuleKey.FI },
  { path: 'ai', label: 'AI Assistant', icon: 'auto_awesome', module: ModuleKey.AI_INSIGHTS },
  { path: 'admin/users', label: 'Users & Roles', icon: 'admin_panel_settings', module: ModuleKey.ADMIN },
  { path: 'integrations', label: 'OEM Integration Hub', icon: 'hub', module: ModuleKey.OEM_INTEGRATIONS },
];

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
  ],
  template: `
    <mat-toolbar color="primary" class="toolbar">
      <span class="brand">AMS — {{ dealerName() }}</span>
      <span class="spacer"></span>
      <button mat-icon-button [matMenuTriggerFor]="userMenu">
        <mat-icon>account_circle</mat-icon>
      </button>
      <mat-menu #userMenu="matMenu">
        <div class="menu-user">{{ userName() }}</div>
        <button mat-menu-item (click)="auth.logout()">
          <mat-icon>logout</mat-icon>
          <span>Sign out</span>
        </button>
      </mat-menu>
    </mat-toolbar>

    <mat-sidenav-container class="container">
      <mat-sidenav mode="side" opened class="sidenav">
        <mat-nav-list>
          @for (item of visibleNavItems(); track item.path) {
            <a mat-list-item [routerLink]="item.path" routerLinkActive="active-link">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>
      <mat-sidenav-content class="content">
        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .toolbar {
        position: sticky;
        top: 0;
        z-index: 10;
      }
      .brand {
        font-weight: 600;
      }
      .spacer {
        flex: 1 1 auto;
      }
      .container {
        height: calc(100vh - 64px);
      }
      .sidenav {
        width: 240px;
      }
      .content {
        padding: 24px;
        background: #f5f6f8;
      }
      .active-link {
        background: rgba(0, 102, 177, 0.08);
      }
      .menu-user {
        padding: 8px 16px;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
      }
    `,
  ],
})
export class ShellComponent {
  readonly auth = inject(AuthService);

  readonly dealerName = computed(() => this.auth.user()?.email.split('@')[1]?.split('.')[0] ?? 'Dealer');
  readonly userName = computed(() => {
    const user = this.auth.user();
    return user ? `${user.firstName} ${user.lastName}` : '';
  });

  readonly visibleNavItems = computed(() =>
    NAV_ITEMS.filter((item) => this.auth.hasPermission(item.module, PermissionAction.VIEW)),
  );
}

import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';
import { AiAssistantDockComponent } from '../features/ai/ai-assistant-dock.component';
import { NotificationsBellComponent } from '../features/notifications/notifications-bell.component';

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
  { path: 'admin/settings', label: 'Settings', icon: 'settings', module: ModuleKey.ADMIN },
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
    MatBadgeModule,
    NotificationsBellComponent,
    AiAssistantDockComponent,
  ],
  template: `
    <mat-toolbar class="toolbar" [style.background]="theme.primaryColour()" [style.color]="'#fff'">
      @if (theme.logoUrl(); as logo) {
        <img [src]="logo" alt="Dealer logo" class="brand-logo" />
      } @else {
        <span class="brand">AMS — {{ theme.dealerName() }}</span>
      }
      <span class="spacer"></span>
      <app-notifications-bell />
      <button mat-icon-button [matMenuTriggerFor]="userMenu">
        <mat-icon>account_circle</mat-icon>
      </button>
      <mat-menu #userMenu="matMenu">
        <div class="menu-user">{{ userName() }}</div>
        <a mat-menu-item routerLink="/my-profile">
          <mat-icon>person</mat-icon>
          <span>My profile</span>
        </a>
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
            <a
              mat-list-item
              [routerLink]="item.path"
              routerLinkActive="active-link"
              [style.--amx-active-bg]="activeLinkTint()"
            >
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

    @if (auth.hasPermission(aiModule, viewAction)) {
      <app-ai-assistant-dock />
    }
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
      .brand-logo {
        height: 32px;
        max-width: 160px;
        object-fit: contain;
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
        background: var(--amx-active-bg, rgba(0, 102, 177, 0.08));
      }
      .menu-user {
        padding: 8px 16px;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
      }
    `,
  ],
})
export class ShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly aiModule = ModuleKey.AI_INSIGHTS;
  readonly viewAction = PermissionAction.VIEW;

  readonly userName = computed(() => {
    const user = this.auth.user();
    return user ? `${user.firstName} ${user.lastName}` : '';
  });

  readonly visibleNavItems = computed(() =>
    NAV_ITEMS.filter((item) => this.auth.hasPermission(item.module, PermissionAction.VIEW)),
  );

  readonly activeLinkTint = computed(() => hexToRgba(this.theme.primaryColour(), 0.1));

  ngOnInit(): void {
    this.theme.load();
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return `rgba(0, 102, 177, ${alpha})`;
  const [, r, g, b] = match;
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
}

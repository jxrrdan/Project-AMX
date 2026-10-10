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
import { ConnectivityService } from '../core/connectivity.service';
import { ThemeService } from '../core/theme.service';
import { BmwRoundelComponent } from '../shared/bmw-roundel.component';
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
  { path: 'online-bookings', label: 'Online Bookings', icon: 'event_available', module: ModuleKey.WORKSHOP },
  { path: 'service-plans', label: 'Service Plans', icon: 'event_repeat', module: ModuleKey.SERVICE_PLANS },
  { path: 'parc', label: 'Vehicle Parc', icon: 'history', module: ModuleKey.VEHICLE_PARC },
  { path: 'parts', label: 'Parts', icon: 'inventory_2', module: ModuleKey.PARTS },
  { path: 'parts/suppliers', label: 'Parts Suppliers', icon: 'local_shipping', module: ModuleKey.PARTS },
  { path: 'used-cars', label: 'Used Cars', icon: 'car_repair', module: ModuleKey.USED_CARS },
  { path: 'warranty', label: 'Warranty', icon: 'verified', module: ModuleKey.WARRANTY },
  { path: 'recalls', label: 'Recalls', icon: 'campaign', module: ModuleKey.RECALLS },
  { path: 'crm', label: 'CRM', icon: 'contacts', module: ModuleKey.CRM },
  { path: 'vhc', label: 'Vehicle Health Check', icon: 'health_and_safety', module: ModuleKey.VHC },
  { path: 'listings', label: 'Stock Listings', icon: 'storefront', module: ModuleKey.LISTINGS },
  { path: 'accounting', label: 'Accounting', icon: 'receipt_long', module: ModuleKey.ACCOUNTING },
  { path: 'credit-notes', label: 'Credit Notes', icon: 'request_quote', module: ModuleKey.CREDIT_NOTES },
  { path: 'cashiering', label: 'Cash Desk', icon: 'point_of_sale', module: ModuleKey.CASHIERING },
  { path: 'account-customers', label: 'Account Customers', icon: 'groups', module: ModuleKey.ACCOUNT_CUSTOMERS },
  { path: 'reports/doc', label: 'Management Reporting', icon: 'insights', module: ModuleKey.MANAGEMENT_REPORTING },
  { path: 'compliance', label: 'Compliance', icon: 'gavel', module: ModuleKey.COMPLIANCE },
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
    BmwRoundelComponent,
  ],
  template: `
    <mat-toolbar class="toolbar">
      <app-bmw-roundel [size]="36" />
      <span class="brand">
        <span class="brand-product">AMS</span>
        <span class="brand-agent">{{ theme.dealerName() }}</span>
      </span>
      @if (theme.logoUrl(); as logo) {
        <img [src]="logo" alt="Agent logo" class="brand-logo" />
      }
      <span class="spacer"></span>
      @if (!connectivity.online()) {
        <span class="offline-chip" title="You're offline — changes are saved on this device and will sync when you reconnect">
          <mat-icon>cloud_off</mat-icon>
          Offline
        </span>
      }
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
        <div class="page amx-page-enter"><router-outlet /></div>
      </mat-sidenav-content>
    </mat-sidenav-container>

    @if (auth.hasPermission(aiModule, viewAction)) {
      <app-ai-assistant-dock />
    }
  `,
  styles: [
    `
      /* BMW chrome: near-black translucent bar, the roundel, and a thin M-colour accent line. */
      .toolbar {
        position: sticky;
        top: 0;
        z-index: 10;
        gap: 14px;
        color: #fff;
        background: rgba(20, 20, 20, 0.96);
        --mat-icon-button-icon-color: #fff;
        --mat-toolbar-container-text-color: #fff;
        --mat-sys-on-surface-variant: #fff;
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06);
      }
      .toolbar::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 3px;
        background: linear-gradient(90deg, #81c4ff 0 33.4%, #0653b6 33.4% 66.7%, #e7222e 66.7% 100%);
      }
      .brand {
        display: inline-flex;
        align-items: baseline;
        gap: 12px;
      }
      .brand-product {
        font-weight: 700;
        letter-spacing: 0.14em;
        font-size: 15px;
      }
      .brand-agent {
        font-weight: 300;
        letter-spacing: 0.02em;
        font-size: 15px;
        opacity: 0.85;
        padding-left: 12px;
        border-left: 1px solid rgba(255, 255, 255, 0.28);
      }
      .brand-logo {
        height: 28px;
        max-width: 140px;
        object-fit: contain;
      }
      .spacer {
        flex: 1 1 auto;
      }
      .container {
        height: calc(100vh - 64px);
        background: var(--amx-bg);
      }
      /* Heavier material for the structural region; no 1px divider, a soft shadow separates it. */
      .sidenav {
        width: 248px;
        background: var(--amx-material-light, rgba(255, 255, 255, 0.72));
        backdrop-filter: var(--amx-material-blur, blur(20px) saturate(180%));
        -webkit-backdrop-filter: var(--amx-material-blur, blur(20px) saturate(180%));
        border-right: none;
        box-shadow: 1px 0 0 var(--amx-hairline, rgba(0, 0, 0, 0.08));
      }
      .content {
        padding: 24px;
        background: var(--amx-bg);
        /* Scroll-edge effect instead of a hard divider where content meets the toolbar. */
        mask-image: linear-gradient(to bottom, transparent 0, #000 12px);
        -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 12px);
      }
      .active-link {
        background: var(--amx-active-bg, rgba(28, 105, 212, 0.1));
        border-radius: var(--mat-sys-corner-medium);
        font-weight: 600;
        box-shadow: inset 3px 0 0 var(--bmw-blue);
      }
      .sidenav a[mat-list-item] {
        border-radius: var(--mat-sys-corner-medium);
        margin: 1px 8px;
        transition:
          background-color 280ms var(--amx-ease, ease),
          transform 100ms ease-out;
      }
      .menu-user {
        padding: 8px 16px;
        font-size: 12px;
        color: var(--amx-text-secondary);
      }
      .offline-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 10px;
        margin-right: 8px;
        border-radius: 12px;
        font-size: 12px;
        background: rgba(255, 255, 255, 0.2);
      }
      .offline-chip mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    `,
  ],
})
export class ShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly connectivity = inject(ConnectivityService);
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
  if (!match) return `rgba(28, 105, 212, ${alpha})`;
  const [, r, g, b] = match;
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
}

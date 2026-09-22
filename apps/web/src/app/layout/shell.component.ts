import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
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

interface NavGroup {
  label: string;
  icon: string;
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

/** Grouped so the left nav doesn't grow one flat row per module — aftersales-adjacent modules
 * (workshop scheduling, technician capacity, VHC, warranty, courtesy fleet) collapse into a single
 * "Aftersales" entry, each with its own row underneath rather than cluttering the top level. */
const NAV_ENTRIES: NavEntry[] = [
  { path: 'dashboard', label: 'Dashboard', icon: 'space_dashboard', module: ModuleKey.DASHBOARD },
  { path: 'vehicles', label: 'New Car & PDI', icon: 'directions_car', module: ModuleKey.NEW_CAR_PDI },
  {
    label: 'Aftersales',
    icon: 'build',
    children: [
      { path: 'workshop', label: 'Workshop Diary', icon: 'event_note', module: ModuleKey.WORKSHOP },
      { path: 'technicians', label: 'Technicians', icon: 'engineering', module: ModuleKey.WORKSHOP },
      { path: 'vhc', label: 'Vehicle Health Check', icon: 'health_and_safety', module: ModuleKey.VHC },
      { path: 'warranty', label: 'Warranty', icon: 'verified', module: ModuleKey.WARRANTY },
      { path: 'courtesy', label: 'Courtesy Fleet', icon: 'time_to_leave', module: ModuleKey.COURTESY_FLEET },
    ],
  },
  { path: 'parts', label: 'Parts', icon: 'inventory_2', module: ModuleKey.PARTS },
  { path: 'used-cars', label: 'Used Cars', icon: 'car_repair', module: ModuleKey.USED_CARS },
  { path: 'crm', label: 'CRM', icon: 'contacts', module: ModuleKey.CRM },
  { path: 'listings', label: 'Stock Listings', icon: 'storefront', module: ModuleKey.LISTINGS },
  {
    label: 'Accounting',
    icon: 'receipt_long',
    children: [
      { path: 'ledger', label: 'Nominal Ledger', icon: 'menu_book', module: ModuleKey.GENERAL_LEDGER },
      { path: 'ledger/purchase', label: 'Purchase Ledger', icon: 'local_shipping', module: ModuleKey.GENERAL_LEDGER },
      {
        path: 'ledger/manufacturer-payments',
        label: 'Manufacturer Payments',
        icon: 'request_quote',
        module: ModuleKey.GENERAL_LEDGER,
      },
      { path: 'accounting', label: 'Integrations & Sync', icon: 'sync', module: ModuleKey.ACCOUNTING },
    ],
  },
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
          @for (entry of visibleNavEntries(); track entry.label) {
            @if (isGroupEntry(entry)) {
              <button mat-list-item class="group-toggle" (click)="toggleGroup(entry.label)">
                <mat-icon matListItemIcon>{{ entry.icon }}</mat-icon>
                <span matListItemTitle>{{ entry.label }}</span>
                <mat-icon class="chevron">{{ isGroupExpanded(entry.label) ? 'expand_less' : 'expand_more' }}</mat-icon>
              </button>
              @if (isGroupExpanded(entry.label)) {
                @for (child of entry.children; track child.path) {
                  <a
                    mat-list-item
                    class="sub-item"
                    [routerLink]="child.path"
                    routerLinkActive="active-link"
                    [style.--amx-active-bg]="activeLinkTint()"
                  >
                    <mat-icon matListItemIcon>{{ child.icon }}</mat-icon>
                    <span matListItemTitle>{{ child.label }}</span>
                  </a>
                }
              }
            } @else {
              <a
                mat-list-item
                [routerLink]="entry.path"
                routerLinkActive="active-link"
                [style.--amx-active-bg]="activeLinkTint()"
              >
                <mat-icon matListItemIcon>{{ entry.icon }}</mat-icon>
                <span matListItemTitle>{{ entry.label }}</span>
              </a>
            }
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
      .group-toggle {
        width: 100%;
        cursor: pointer;
      }
      .chevron {
        margin-left: auto;
        color: rgba(0, 0, 0, 0.4);
      }
      .sub-item {
        padding-left: 16px;
      }
      .sub-item mat-icon[matListItemIcon] {
        transform: scale(0.85);
      }
      .menu-user {
        padding: 8px 16px;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
      }
    `,
  ],
})
export class ShellComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  readonly aiModule = ModuleKey.AI_INSIGHTS;
  readonly viewAction = PermissionAction.VIEW;

  private readonly expandedGroups = signal<Set<string>>(new Set());
  private routerSub?: Subscription;

  readonly userName = computed(() => {
    const user = this.auth.user();
    return user ? `${user.firstName} ${user.lastName}` : '';
  });

  readonly visibleNavEntries = computed<NavEntry[]>(() =>
    NAV_ENTRIES.map((entry) =>
      isGroup(entry)
        ? { ...entry, children: entry.children.filter((c) => this.auth.hasPermission(c.module, PermissionAction.VIEW)) }
        : entry,
    ).filter((entry) => (isGroup(entry) ? entry.children.length > 0 : this.auth.hasPermission(entry.module, PermissionAction.VIEW))),
  );

  readonly activeLinkTint = computed(() => hexToRgba(this.theme.primaryColour(), 0.1));

  isGroupEntry(entry: NavEntry): entry is NavGroup {
    return isGroup(entry);
  }

  isGroupExpanded(label: string): boolean {
    return this.expandedGroups().has(label);
  }

  toggleGroup(label: string): void {
    const next = new Set(this.expandedGroups());
    if (next.has(label)) {
      next.delete(label);
    } else {
      next.add(label);
    }
    this.expandedGroups.set(next);
  }

  private expandGroupForCurrentUrl(url: string): void {
    for (const entry of NAV_ENTRIES) {
      if (isGroup(entry) && entry.children.some((c) => url.startsWith(`/${c.path}`))) {
        const next = new Set(this.expandedGroups());
        next.add(entry.label);
        this.expandedGroups.set(next);
      }
    }
  }

  ngOnInit(): void {
    this.theme.load();
    this.expandGroupForCurrentUrl(this.router.url);
    this.routerSub = this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.expandGroupForCurrentUrl((e as NavigationEnd).urlAfterRedirects);
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return `rgba(0, 102, 177, ${alpha})`;
  const [, r, g, b] = match;
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
}

import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DealerBranding {
  id: string;
  name: string;
  address: string | null;
  logoUrl: string | null;
  primaryColour: string | null;
  secondaryColour: string | null;
  vatNumber: string | null;
  invoiceFooterNote: string | null;
  timeZone: string;
  locale: string;
  franchiseCode: string | null;
  risDealerId: string | null;
  awpWebhookUrl: string | null;
  workshopBoardToken: string;
}

const DEFAULT_PRIMARY = '#0066B1';
const DEFAULT_SECONDARY = '#1C69D4';

/**
 * Fetches the dealer's branding (Settings > Branding) once per session and exposes it as
 * signals the shell/other components bind to directly (toolbar colour, sidenav active-link tint,
 * logo) — deliberately plain inline-style bindings rather than trying to override Angular
 * Material's internal M3 design tokens, which is far more reliable to reason about and verify.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly http = inject(HttpClient);

  private readonly dealerSignal = signal<DealerBranding | null>(null);
  readonly dealer = computed(() => this.dealerSignal());
  readonly primaryColour = computed(() => this.dealerSignal()?.primaryColour || DEFAULT_PRIMARY);
  readonly secondaryColour = computed(() => this.dealerSignal()?.secondaryColour || DEFAULT_SECONDARY);
  readonly logoUrl = computed(() => this.dealerSignal()?.logoUrl || null);
  readonly dealerName = computed(() => this.dealerSignal()?.name || 'Dealer');

  async load(): Promise<void> {
    const dealer = await firstValueFrom(this.http.get<DealerBranding>(`${environment.apiUrl}/dealers/me`));
    this.dealerSignal.set(dealer);
  }

  clear(): void {
    this.dealerSignal.set(null);
  }
}

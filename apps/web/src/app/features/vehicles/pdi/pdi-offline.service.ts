import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ConnectivityService } from '../../../core/connectivity.service';
import { STORE_MUTATIONS, STORE_PDI_JOBS, idbAvailable, idbDelete, idbGet, idbGetAll, idbPut } from '../../../core/idb.util';

export interface PdiChecklistItem {
  id: string;
  category: string;
  label: string;
  rating: 'PASS' | 'ADVISORY' | 'FAIL' | null;
  notes: string | null;
  sortOrder: number;
}

export interface PdiJob {
  id: string;
  vehicleId: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETE';
  scheduledDate: string;
  signedOffBy: string | null;
  signedOffAt: string | null;
  checklistPdfUrl: string | null;
  checklistItems: PdiChecklistItem[];
}

/** A record cached per vehicle so the whole checklist survives a page reload offline. */
interface CachedJob {
  vehicleId: string;
  job: PdiJob;
  cachedAt: string;
}

type Mutation =
  | { seq?: number; kind: 'item'; itemId: string; rating: 'PASS' | 'ADVISORY' | 'FAIL'; notes: string | null }
  | { seq?: number; kind: 'signoff'; jobId: string; signedOffBy: string };

/**
 * Offline-first data layer for PDI checklists (Feature Spec §Non-functional: the PDI
 * checklist must work offline). Reads come from the network when available and are
 * cached in IndexedDB; writes are applied to the local cache immediately and appended
 * to a durable mutation queue that is replayed, in order, whenever connectivity
 * returns. This means a technician can rate every item and even sign off in a
 * signal-dead bay, and it all uploads once they're back in range.
 */
@Injectable({ providedIn: 'root' })
export class PdiOfflineService {
  private readonly http = inject(HttpClient);
  private readonly connectivity = inject(ConnectivityService);

  private readonly jobSignal = signal<PdiJob | null>(null);
  private readonly pendingSignal = signal<number>(0);
  private readonly syncingSignal = signal<boolean>(false);
  private readonly fromCacheSignal = signal<boolean>(false);

  /** The checklist currently loaded, with any unsynced local edits already applied. */
  readonly job = this.jobSignal.asReadonly();
  /** How many local changes are still waiting to upload. */
  readonly pendingCount = this.pendingSignal.asReadonly();
  readonly syncing = this.syncingSignal.asReadonly();
  /** True when the loaded job came from the offline cache rather than the network. */
  readonly loadedFromCache = this.fromCacheSignal.asReadonly();
  readonly online = this.connectivity.online;
  readonly hasPending = computed(() => this.pendingSignal() > 0);

  constructor() {
    void this.refreshPendingCount();
    // Replay the queue automatically the moment the browser reports it's back online.
    effect(() => {
      if (this.connectivity.online()) {
        void this.flush();
      }
    });
  }

  /**
   * Load the latest PDI job for a vehicle. Prefers the network (and refreshes the
   * cache); falls back to the cached snapshot when offline or the request fails.
   * Any queued local edits are overlaid so the UI reflects unsynced work.
   */
  async load(vehicleId: string): Promise<PdiJob | null> {
    let job: PdiJob | null = null;
    let fromCache = false;

    if (this.connectivity.online()) {
      try {
        const vehicle = await firstValueFrom(
          this.http.get<{ pdiJobs?: PdiJob[] }>(`${environment.apiUrl}/vehicles/${vehicleId}`),
        );
        job = this.pickJob(vehicle?.pdiJobs ?? []);
        if (job && idbAvailable()) {
          await idbPut<CachedJob>(STORE_PDI_JOBS, { vehicleId, job, cachedAt: new Date().toISOString() });
        }
      } catch {
        // Network said online but the request failed — fall through to the cache.
      }
    }

    if (!job && idbAvailable()) {
      const cached = await idbGet<CachedJob>(STORE_PDI_JOBS, vehicleId);
      if (cached) {
        job = cached.job;
        fromCache = true;
      }
    }

    if (job) {
      job = await this.applyPendingTo(job);
    }
    this.fromCacheSignal.set(fromCache);
    this.jobSignal.set(job);
    await this.refreshPendingCount();
    return job;
  }

  /** Rate a single checklist item (with optional notes). Works offline. */
  async rateItem(itemId: string, rating: 'PASS' | 'ADVISORY' | 'FAIL', notes: string | null): Promise<void> {
    this.patchLocalItem(itemId, { rating, notes });
    await this.enqueue({ kind: 'item', itemId, rating, notes });
    await this.flush();
  }

  /** Sign off the checklist. Requires every item rated (enforced by the caller/UI too). */
  async signOff(jobId: string, signedOffBy: string): Promise<void> {
    const current = this.jobSignal();
    if (current && current.id === jobId) {
      // Optimistic local status so the UI reflects the intent even while queued offline.
      this.jobSignal.set({ ...current, status: 'COMPLETE', signedOffBy, signedOffAt: new Date().toISOString() });
    }
    await this.enqueue({ kind: 'signoff', jobId, signedOffBy });
    await this.flush();
  }

  /** Replay every queued mutation in order. Safe to call repeatedly. */
  async flush(): Promise<void> {
    if (!idbAvailable() || this.syncingSignal() || !this.connectivity.online()) {
      return;
    }
    this.syncingSignal.set(true);
    try {
      const queue = (await idbGetAll<Mutation>(STORE_MUTATIONS)).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
      for (const mutation of queue) {
        try {
          await this.send(mutation);
        } catch (err) {
          if (this.isNetworkError(err)) {
            // Still offline — keep this and everything after it for the next attempt.
            break;
          }
          // Server rejected it (e.g. already signed off, validation): drop it so the
          // queue can't wedge, but surface it in the console for diagnosis.
          console.error('Dropping unreplayable PDI mutation', mutation, err);
        }
        if (mutation.seq !== undefined) {
          await idbDelete(STORE_MUTATIONS, mutation.seq);
        }
      }
    } finally {
      this.syncingSignal.set(false);
      await this.refreshPendingCount();
      // Re-pull the authoritative server state (PDF url, sign-off timestamp) once the
      // queue has drained and we're online.
      const current = this.jobSignal();
      if (current && this.connectivity.online() && this.pendingSignal() === 0) {
        await this.reloadFromServer(current.vehicleId);
      }
    }
  }

  private async send(mutation: Mutation): Promise<void> {
    if (mutation.kind === 'item') {
      await firstValueFrom(
        this.http.patch(`${environment.apiUrl}/pdi-checklist-items/${mutation.itemId}`, {
          rating: mutation.rating,
          notes: mutation.notes ?? undefined,
        }),
      );
    } else {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/pdi/${mutation.jobId}/sign-off`, { signedOffBy: mutation.signedOffBy }),
      );
    }
  }

  private async reloadFromServer(vehicleId: string): Promise<void> {
    try {
      const vehicle = await firstValueFrom(
        this.http.get<{ pdiJobs?: PdiJob[] }>(`${environment.apiUrl}/vehicles/${vehicleId}`),
      );
      const job = this.pickJob(vehicle?.pdiJobs ?? []);
      if (job) {
        if (idbAvailable()) {
          await idbPut<CachedJob>(STORE_PDI_JOBS, { vehicleId, job, cachedAt: new Date().toISOString() });
        }
        this.fromCacheSignal.set(false);
        this.jobSignal.set(job);
      }
    } catch {
      // Best-effort refresh; the optimistic local state stands if it fails.
    }
  }

  /** Choose the checklist a technician should be working on: the open one, else the newest. */
  private pickJob(jobs: PdiJob[]): PdiJob | null {
    if (!jobs.length) {
      return null;
    }
    const byDateDesc = [...jobs].sort(
      (a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime(),
    );
    return byDateDesc.find((j) => j.status !== 'COMPLETE') ?? byDateDesc[0];
  }

  private patchLocalItem(itemId: string, patch: Partial<PdiChecklistItem>): void {
    const current = this.jobSignal();
    if (!current) {
      return;
    }
    const items = current.checklistItems.map((item) => (item.id === itemId ? { ...item, ...patch } : item));
    const updated: PdiJob = { ...current, checklistItems: items };
    this.jobSignal.set(updated);
    if (idbAvailable()) {
      void idbPut<CachedJob>(STORE_PDI_JOBS, {
        vehicleId: updated.vehicleId,
        job: updated,
        cachedAt: new Date().toISOString(),
      });
    }
  }

  private async applyPendingTo(job: PdiJob): Promise<PdiJob> {
    if (!idbAvailable()) {
      return job;
    }
    const queue = (await idbGetAll<Mutation>(STORE_MUTATIONS)).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    let items = job.checklistItems;
    let status = job.status;
    let signedOffBy = job.signedOffBy;
    for (const mutation of queue) {
      if (mutation.kind === 'item') {
        items = items.map((item) =>
          item.id === mutation.itemId ? { ...item, rating: mutation.rating, notes: mutation.notes } : item,
        );
      } else if (mutation.kind === 'signoff' && mutation.jobId === job.id) {
        status = 'COMPLETE';
        signedOffBy = mutation.signedOffBy;
      }
    }
    return { ...job, checklistItems: items, status, signedOffBy };
  }

  private async enqueue(mutation: Mutation): Promise<void> {
    if (idbAvailable()) {
      await idbPut<Mutation>(STORE_MUTATIONS, mutation);
    }
    await this.refreshPendingCount();
  }

  private async refreshPendingCount(): Promise<void> {
    if (!idbAvailable()) {
      this.pendingSignal.set(0);
      return;
    }
    const queue = await idbGetAll<Mutation>(STORE_MUTATIONS);
    this.pendingSignal.set(queue.length);
  }

  private isNetworkError(err: unknown): boolean {
    // HttpClient reports network failures / CORS / offline as status 0.
    return err instanceof HttpErrorResponse && err.status === 0;
  }
}

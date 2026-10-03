import { Injectable, signal } from '@angular/core';

/**
 * Tracks online/offline state as a signal so components and services can react to
 * connectivity changes (e.g. flush the offline PDI mutation queue on reconnect).
 * `navigator.onLine` is the best-effort browser signal; it can be optimistic
 * (reports online when the network is up but the API is unreachable), so the
 * offline layer treats a failed request as "offline" regardless of this flag.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly onlineSignal = signal<boolean>(this.readInitial());
  readonly online = this.onlineSignal.asReadonly();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.onlineSignal.set(true));
      window.addEventListener('offline', () => this.onlineSignal.set(false));
    }
  }

  private readInitial(): boolean {
    try {
      return typeof navigator === 'undefined' ? true : navigator.onLine;
    } catch {
      return true;
    }
  }
}

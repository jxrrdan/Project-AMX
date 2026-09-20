import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Shared chat state/logic behind both the full-page AI Assistant (/ai — a dedicated window with
 * the complete history) and the AiAssistantDockComponent (a floating panel mounted in the shell so
 * the assistant is reachable from every module/screen, not just its own page). Both surfaces read
 * and write the SAME conversation via this single service, so opening the dock from Parts and then
 * later opening the full /ai page shows the same thread rather than two disconnected ones.
 */
@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  readonly history = signal<ChatEntry[]>([]);
  readonly loading = signal(false);

  private conversationId: string | undefined;
  private readonly http = inject(HttpClient);

  send(message: string): void {
    if (!message.trim()) return;
    this.history.update((h) => [...h, { role: 'user', content: message }]);
    this.loading.set(true);

    this.http
      .post<{ conversationId: string; reply: string }>(`${environment.apiUrl}/ai/assistant/chat`, {
        conversationId: this.conversationId,
        message,
      })
      .subscribe({
        next: (res) => {
          this.conversationId = res.conversationId;
          this.history.update((h) => [...h, { role: 'assistant', content: res.reply }]);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}

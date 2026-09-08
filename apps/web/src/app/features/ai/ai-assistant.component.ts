import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';

interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-ai-assistant',
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatCardModule, MatProgressSpinnerModule],
  template: `
    <h1>AI Assistant</h1>
    <p class="hint">
      Ask about operational data across every module — e.g. "Show me all used cars in stock over 60 days" or
      "What warranty claims are still awaiting authorisation?"
    </p>

    <mat-card class="chat">
      @for (entry of history(); track $index) {
        <div class="bubble" [class.user]="entry.role === 'user'">{{ entry.content }}</div>
      }
      @if (loading()) {
        <mat-spinner diameter="24"></mat-spinner>
      }
    </mat-card>

    <div class="composer">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Ask a question</mat-label>
        <input matInput [(ngModel)]="message" (keyup.enter)="send()" />
      </mat-form-field>
      <button mat-flat-button color="primary" (click)="send()" [disabled]="loading() || !message">Send</button>
    </div>
  `,
  styles: [
    `
      .hint {
        color: rgba(0, 0, 0, 0.6);
        max-width: 640px;
      }
      .chat {
        min-height: 240px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
      }
      .bubble {
        align-self: flex-start;
        background: #eceff1;
        padding: 8px 12px;
        border-radius: 12px;
        max-width: 70%;
      }
      .bubble.user {
        align-self: flex-end;
        background: #0066b1;
        color: white;
      }
      .composer {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }
      .full-width {
        flex: 1;
      }
    `,
  ],
})
export class AiAssistantComponent {
  readonly history = signal<ChatEntry[]>([]);
  readonly loading = signal(false);
  message = '';
  private conversationId: string | undefined;

  private readonly http = inject(HttpClient);

  send(): void {
    if (!this.message.trim()) return;
    const userMessage = this.message;
    this.history.update((h) => [...h, { role: 'user', content: userMessage }]);
    this.message = '';
    this.loading.set(true);

    this.http
      .post<{ conversationId: string; reply: string }>(`${environment.apiUrl}/ai/assistant/chat`, {
        conversationId: this.conversationId,
        message: userMessage,
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

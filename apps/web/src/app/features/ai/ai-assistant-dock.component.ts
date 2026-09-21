import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AiAssistantService } from './ai-assistant.service';

/**
 * The AI Assistant, available from every module/screen rather than only its own page — a floating
 * button (bottom-right, above the routed content) that opens a small chat panel. Shares its state
 * with the full /ai page via AiAssistantService, so the two are the same conversation: this dock is
 * for a quick question without leaving the current screen, and /ai remains the dedicated window for
 * scrolling back through the full history.
 */
@Component({
  selector: 'app-ai-assistant-dock',
  imports: [FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule],
  template: `
    @if (open()) {
      <div class="panel">
        <div class="panel-header">
          <span>AI Assistant</span>
          <a mat-icon-button routerLink="/ai" [attr.title]="'Open full assistant'" (click)="open.set(false)">
            <mat-icon>open_in_full</mat-icon>
          </a>
          <button mat-icon-button (click)="open.set(false)"><mat-icon>close</mat-icon></button>
        </div>
        <div class="messages">
          @for (entry of assistant.history(); track $index) {
            <div class="bubble" [class.user]="entry.role === 'user'">{{ entry.content }}</div>
          } @empty {
            <p class="hint">Ask about operational data across any module — e.g. "What jobs are overdue today?"</p>
          }
          @if (assistant.loading()) {
            <mat-spinner diameter="20"></mat-spinner>
          }
        </div>
        <div class="composer">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Ask a question</mat-label>
            <input matInput [(ngModel)]="message" (keyup.enter)="send()" />
          </mat-form-field>
          <button mat-icon-button color="primary" (click)="send()" [disabled]="assistant.loading() || !message">
            <mat-icon>send</mat-icon>
          </button>
        </div>
      </div>
    } @else {
      <button mat-fab color="primary" class="fab" (click)="open.set(true)" title="AI Assistant">
        <mat-icon>auto_awesome</mat-icon>
      </button>
    }
  `,
  styles: [
    `
      :host {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 1000;
      }
      .fab {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      }
      .panel {
        width: 340px;
        height: 440px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .panel-header {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px 12px;
        background: #0066b1;
        color: white;
        font-weight: 600;
      }
      .panel-header span {
        flex: 1;
      }
      .panel-header a,
      .panel-header button {
        color: white;
      }
      .messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .bubble {
        align-self: flex-start;
        background: #eceff1;
        padding: 6px 10px;
        border-radius: 10px;
        max-width: 85%;
        font-size: 13px;
      }
      .bubble.user {
        align-self: flex-end;
        background: #0066b1;
        color: white;
      }
      .hint {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.5);
      }
      .composer {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px;
        border-top: 1px solid #eee;
      }
      .full-width {
        flex: 1;
      }
      ::ng-deep .composer .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    `,
  ],
})
export class AiAssistantDockComponent {
  readonly assistant = inject(AiAssistantService);
  readonly open = signal(false);
  message = '';

  send(): void {
    if (!this.message.trim()) return;
    this.assistant.send(this.message);
    this.message = '';
  }
}

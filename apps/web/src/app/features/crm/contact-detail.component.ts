import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  CALL_DIRECTION_LABELS,
  CALL_OUTCOME_LABELS,
  CallDirection,
  CallOutcome,
  CrmActivityType,
  IntegrationTargetEntity,
} from '@project-amx/shared';
import { CustomFieldsPanelComponent } from '../integrations/custom-fields-panel.component';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';

interface ContactDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  gdprConsent: boolean;
  leads: { id: string; stage: string }[];
  activities: { id: string; type: string; notes: string | null; createdAt: string }[];
  tasks: { id: string; title: string; dueDate: string; completedAt: string | null }[];
}

interface CallLogEntry {
  id: string;
  direction: CallDirection;
  outcome: CallOutcome;
  notes: string | null;
  calledAt: string;
}

interface CustomerInvoiceSummary {
  id: string;
  invoiceNumber: string;
  description: string;
  amount: number;
  vatAmount: number;
  totalAmount: number;
  pdfUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface EmailTemplate {
  id: string;
  name: string;
}

@Component({
  selector: 'app-contact-detail',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    CustomFieldsPanelComponent,
  ],
  template: `
    @if (contact(); as c) {
      <div class="header">
        <div>
          <h1>{{ c.firstName }} {{ c.lastName }}</h1>
          <p class="meta">
            {{ c.email }} · {{ c.phone }} ·
            <mat-chip>{{ c.status }}</mat-chip>
            @if (c.gdprConsent) {
              <mat-chip>GDPR consented</mat-chip>
            }
          </p>
        </div>
        <a mat-stroked-button routerLink="/crm/contacts">
          <mat-icon>arrow_back</mat-icon>
          All contacts
        </a>
      </div>

      <div class="columns">
        <div class="col">
          <mat-card>
            <h3>Leads</h3>
            @for (lead of c.leads; track lead.id) {
              <mat-chip>{{ lead.stage }}</mat-chip>
            } @empty {
              <p class="empty">No leads yet.</p>
            }
          </mat-card>

          <mat-card>
            <h3>Send email</h3>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Template</mat-label>
              <mat-select [(ngModel)]="selectedTemplateId">
                @for (t of templates(); track t.id) {
                  <mat-option [value]="t.id">{{ t.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <button mat-flat-button color="primary" [disabled]="!selectedTemplateId" (click)="sendEmail()">Send</button>
          </mat-card>

          <mat-card>
            <h3>Send SMS</h3>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Message</mat-label>
              <textarea matInput rows="3" [(ngModel)]="smsBody"></textarea>
            </mat-form-field>
            <button mat-flat-button color="primary" [disabled]="!smsBody" (click)="sendSms()">Send</button>
          </mat-card>

          <mat-card>
            <h3>Send WhatsApp</h3>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Message</mat-label>
              <textarea matInput rows="3" [(ngModel)]="whatsAppBody"></textarea>
            </mat-form-field>
            <button mat-flat-button color="primary" [disabled]="!whatsAppBody" (click)="sendWhatsApp()">Send</button>
          </mat-card>
        </div>

        <div class="col">
          <mat-card>
            <h3>Log an activity</h3>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Type</mat-label>
              <mat-select [(ngModel)]="activityType">
                <mat-option value="CALL">Call</mat-option>
                <mat-option value="MEETING">Meeting</mat-option>
                <mat-option value="NOTE">Note</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Notes</mat-label>
              <textarea matInput rows="2" [(ngModel)]="activityNotes"></textarea>
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="logActivity()">Log activity</button>

            <h3>Activity timeline</h3>
            @for (a of c.activities; track a.id) {
              <div class="timeline-item">
                <span class="type">{{ a.type }}</span>
                <span class="date">{{ a.createdAt | date: 'd MMM, HH:mm' }}</span>
                <p>{{ a.notes }}</p>
              </div>
            } @empty {
              <p class="empty">No activity logged yet.</p>
            }
          </mat-card>

          <mat-card>
            <h3>Log a call</h3>
            <div class="row">
              <mat-form-field appearance="outline">
                <mat-label>Direction</mat-label>
                <mat-select [(ngModel)]="callDirection">
                  @for (d of callDirections; track d) {
                    <mat-option [value]="d">{{ callDirectionLabels[d] }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Outcome</mat-label>
                <mat-select [(ngModel)]="callOutcome">
                  @for (o of callOutcomes; track o) {
                    <mat-option [value]="o">{{ callOutcomeLabels[o] }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Notes (optional)</mat-label>
              <textarea matInput rows="2" [(ngModel)]="callNotes"></textarea>
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="logCall()">Log call</button>

            <h3>Call history</h3>
            @for (call of calls(); track call.id) {
              <div class="timeline-item">
                <span class="type">{{ callDirectionLabels[call.direction] }} — {{ callOutcomeLabels[call.outcome] }}</span>
                <span class="date">{{ call.calledAt | date: 'd MMM, HH:mm' }}</span>
                @if (call.notes) { <p>{{ call.notes }}</p> }
              </div>
            } @empty {
              <p class="empty">No calls logged yet.</p>
            }
          </mat-card>

          <mat-card>
            <h3>Create a follow-up task</h3>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Title</mat-label>
              <input matInput [(ngModel)]="taskTitle" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Due date</mat-label>
              <input matInput type="date" [(ngModel)]="taskDueDate" />
            </mat-form-field>
            <button mat-flat-button color="primary" [disabled]="!taskTitle || !taskDueDate" (click)="createTask()">
              Create task
            </button>

            <h3>Tasks</h3>
            @for (t of c.tasks; track t.id) {
              <div class="timeline-item">
                <span class="type">{{ t.title }}</span>
                <span class="date">due {{ t.dueDate | date: 'd MMM' }}</span>
                @if (t.completedAt) {
                  <mat-chip>Done</mat-chip>
                } @else {
                  <button mat-button (click)="completeTask(t.id)">Mark done</button>
                }
              </div>
            } @empty {
              <p class="empty">No tasks yet.</p>
            }
          </mat-card>

          <mat-card>
            <h3>Customer support invoicing</h3>
            <p class="hint">Ad-hoc charges outside a workshop job — goodwill gestures, admin fees, lost-key charges.</p>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Description</mat-label>
              <input matInput [(ngModel)]="invoiceDescription" placeholder="e.g. Replacement key fob" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Amount (£, excl. VAT)</mat-label>
              <input matInput type="number" [(ngModel)]="invoiceAmount" />
            </mat-form-field>
            <button mat-flat-button color="primary" [disabled]="!invoiceDescription || !invoiceAmount" (click)="createCustomerInvoice()">
              Raise invoice
            </button>

            @for (inv of invoices(); track inv.id) {
              <div class="timeline-item">
                <span class="type">{{ inv.invoiceNumber }} — {{ inv.description }}</span>
                <span class="date">{{ inv.totalAmount | currency: 'GBP' }}</span>
                @if (inv.pdfUrl) {
                  <a [href]="storageUrl(inv.pdfUrl)" target="_blank" rel="noopener">View document</a>
                }
                @if (inv.paidAt) {
                  <mat-chip class="paid-chip">Paid</mat-chip>
                } @else {
                  <button mat-button (click)="takeInvoicePayment(inv.id)">Take payment</button>
                  <button mat-button (click)="copyInvoicePaymentLink(inv.id)">Copy pay-online link</button>
                }
              </div>
            } @empty {
              <p class="empty">No invoices raised yet.</p>
            }
          </mat-card>
        </div>
      </div>

      <app-custom-fields-panel [entity]="contactEntity" [recordId]="c.id" />
    }
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
      }
      .meta {
        color: rgba(0, 0, 0, 0.6);
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      mat-card {
        padding: 16px;
      }
      .full-width {
        width: 100%;
      }
      .timeline-item {
        border-bottom: 1px solid #eee;
        padding: 8px 0;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .timeline-item p {
        flex-basis: 100%;
        margin: 4px 0 0;
        color: rgba(0, 0, 0, 0.7);
      }
      .paid-chip {
        background: #e8f5e9;
        font-size: 11px;
      }
      .row {
        display: flex;
        gap: 12px;
      }
      .type {
        font-weight: 600;
      }
      .date {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.5);
      }
      .empty {
        color: rgba(0, 0, 0, 0.5);
        font-size: 13px;
      }
    `,
  ],
})
export class ContactDetailComponent implements OnInit {
  readonly contact = signal<ContactDetail | null>(null);
  readonly templates = signal<EmailTemplate[]>([]);
  readonly invoices = signal<CustomerInvoiceSummary[]>([]);
  readonly calls = signal<CallLogEntry[]>([]);
  readonly callDirections = Object.values(CallDirection);
  readonly callDirectionLabels = CALL_DIRECTION_LABELS;
  readonly callOutcomes = Object.values(CallOutcome);
  readonly callOutcomeLabels = CALL_OUTCOME_LABELS;
  readonly contactEntity = IntegrationTargetEntity.CONTACT;

  selectedTemplateId = '';
  smsBody = '';
  whatsAppBody = '';
  activityType: CrmActivityType = CrmActivityType.NOTE;
  activityNotes = '';
  taskTitle = '';
  taskDueDate = '';
  invoiceDescription = '';
  invoiceAmount: number | null = null;
  callDirection: CallDirection = CallDirection.OUTBOUND;
  callOutcome: CallOutcome = CallOutcome.CONNECTED;
  callNotes = '';

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private contactId = '';

  ngOnInit(): void {
    this.contactId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
    this.loadInvoices();
    this.loadCalls();
    this.http.get<EmailTemplate[]>(`${environment.apiUrl}/email-templates`).subscribe((data) => this.templates.set(data));
  }

  load(): void {
    this.http.get<ContactDetail>(`${environment.apiUrl}/contacts/${this.contactId}`).subscribe((data) => this.contact.set(data));
  }

  loadInvoices(): void {
    this.http
      .get<CustomerInvoiceSummary[]>(`${environment.apiUrl}/contacts/${this.contactId}/invoices`)
      .subscribe((data) => this.invoices.set(data));
  }

  loadCalls(): void {
    this.http.get<CallLogEntry[]>(`${environment.apiUrl}/contacts/${this.contactId}/calls`).subscribe((data) => this.calls.set(data));
  }

  logCall(): void {
    this.http
      .post(`${environment.apiUrl}/contacts/${this.contactId}/calls`, {
        direction: this.callDirection,
        outcome: this.callOutcome,
        notes: this.callNotes || undefined,
      })
      .subscribe({
        next: () => {
          this.callNotes = '';
          this.loadCalls();
        },
        error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not log call', 'Dismiss', { duration: 4000 }),
      });
  }

  takeInvoicePayment(invoiceId: string): void {
    this.http.post(`${environment.apiUrl}/payments/CUSTOMER_INVOICE/${invoiceId}`, { sourceType: 'CUSTOMER_INVOICE', method: 'CARD' }).subscribe({
      next: () => {
        this.snackBar.open('Payment taken', 'Dismiss', { duration: 3000 });
        this.loadInvoices();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Payment failed', 'Dismiss', { duration: 4000 }),
    });
  }

  copyInvoicePaymentLink(invoiceId: string): void {
    const url = `${window.location.origin}/pay/CUSTOMER_INVOICE/${invoiceId}`;
    navigator.clipboard.writeText(url).then(() => this.snackBar.open('Payment link copied', 'Dismiss', { duration: 3000 }));
  }

  createCustomerInvoice(): void {
    if (!this.invoiceDescription || this.invoiceAmount == null) return;
    this.http
      .post(`${environment.apiUrl}/contacts/${this.contactId}/invoices`, {
        description: this.invoiceDescription,
        amount: this.invoiceAmount,
      })
      .subscribe({
        next: () => {
          this.invoiceDescription = '';
          this.invoiceAmount = null;
          this.loadInvoices();
        },
        error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not raise invoice', 'Dismiss', { duration: 4000 }),
      });
  }

  storageUrl(path: string): string {
    return `${environment.apiUrl.replace(/\/api$/, '')}${path}`;
  }

  logActivity(): void {
    this.http
      .post(`${environment.apiUrl}/crm-activities`, { contactId: this.contactId, type: this.activityType, notes: this.activityNotes })
      .subscribe(() => {
        this.activityNotes = '';
        this.load();
      });
  }

  createTask(): void {
    const user = this.auth.user();
    if (!user) return;
    this.http
      .post(`${environment.apiUrl}/crm-tasks`, {
        contactId: this.contactId,
        assigneeId: user.id,
        title: this.taskTitle,
        dueDate: new Date(this.taskDueDate).toISOString(),
      })
      .subscribe(() => {
        this.taskTitle = '';
        this.taskDueDate = '';
        this.load();
      });
  }

  completeTask(taskId: string): void {
    this.http.patch(`${environment.apiUrl}/crm-tasks/${taskId}/complete`, {}).subscribe(() => this.load());
  }

  sendEmail(): void {
    this.http
      .post(`${environment.apiUrl}/emails/send`, { contactId: this.contactId, templateId: this.selectedTemplateId })
      .subscribe({
        next: () => this.snackBar.open('Email sent (see the console-log adapter output)', 'Dismiss', { duration: 4000 }),
        error: () => this.snackBar.open('Failed to send email — does this contact have an email address?', 'Dismiss', { duration: 4000 }),
      });
  }

  sendSms(): void {
    this.http.post(`${environment.apiUrl}/sms/send`, { contactId: this.contactId, body: this.smsBody }).subscribe({
      next: () => {
        this.smsBody = '';
        this.snackBar.open('SMS sent (see the console-log adapter output)', 'Dismiss', { duration: 4000 });
      },
      error: () => this.snackBar.open('Failed to send SMS — does this contact have a phone number?', 'Dismiss', { duration: 4000 }),
    });
  }

  sendWhatsApp(): void {
    this.http.post(`${environment.apiUrl}/whatsapp/send`, { contactId: this.contactId, body: this.whatsAppBody }).subscribe({
      next: () => {
        this.whatsAppBody = '';
        this.snackBar.open('WhatsApp message sent (see the console-log adapter output)', 'Dismiss', { duration: 4000 });
      },
      error: () => this.snackBar.open('Failed to send WhatsApp message — does this contact have a phone number?', 'Dismiss', { duration: 4000 }),
    });
  }
}

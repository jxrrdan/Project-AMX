import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  COMMON_DOCUMENT_TEMPLATE_VARIABLES,
  DOCUMENT_TEMPLATE_TYPE_LABELS,
  DOCUMENT_TEMPLATE_VARIABLES,
  DocumentTemplateType,
  type DocumentTemplateVariable,
} from '@project-amx/shared';
import { environment } from '../../../environments/environment';

const STARTER_BODY = `<html>
<head>
<style>
  body { font-family: sans-serif; color: #222; }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .header img { height: 48px; }
  .footer { margin-top: 24px; font-size: 11px; color: #666; }
</style>
</head>
<body>
  <div class="header">
    {{#if dealerLogoUrl}}<img src="{{dealerLogoUrl}}" />{{/if}}
    <div>
      <h1 style="margin:0">{{dealerName}}</h1>
      <p style="margin:0">{{dealerAddress}}</p>
    </div>
  </div>

  <h2>Document title</h2>
  <p>Write your document content here, using the "Insert variable" menu to pull in dealer/document data.</p>

  <div class="footer">{{dealerInvoiceFooterNote}}</div>
</body>
</html>`;

/** Sample values used only for the live preview pane — the real render (Handlebars, server-side)
 * happens when the document is actually generated; this is a lighter approximation so a business
 * user can see roughly what they're building without a round trip. */
const PREVIEW_SAMPLES: Record<string, string> = {
  dealerName: 'BMW Northampton',
  dealerAddress: '1 Silverstone Road, Northampton, NN1 1AA',
  dealerLogoUrl: '',
  dealerVatNumber: 'GB123456789',
  dealerInvoiceFooterNote: 'BMW Northampton is a trading name of AMS Demo Ltd.',
  documentDate: new Date().toLocaleDateString('en-GB'),
  documentNumber: 'DS-2026-00001',
  'vehicle.reg': 'AB12 CDE',
  'vehicle.make': 'BMW',
  'vehicle.model': '3 Series',
  sellingPrice: '18,995.00',
  partExchangeValue: '4,500.00',
  financeContribution: '500.00',
  accessoriesTotal: '250.00',
  grossProfit: '3,250.00',
  invoiceNumber: 'INV-2026-00001',
  customerName: 'Jamie Smith',
  totalAmount: '18,995.00',
  agreedValue: '4,500.00',
  vehicleReg: 'AB12 CDE',
  estimatedTotal: '450.00',
  handoverDate: new Date().toLocaleDateString('en-GB'),
  salesExecutiveName: 'Morgan Taylor',
};

@Component({
  selector: 'app-document-template-editor',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule],
  template: `
    <div class="header">
      <div>
        <button mat-icon-button (click)="back()"><mat-icon>arrow_back</mat-icon></button>
        <span class="title">{{ isNew ? 'New' : 'Edit' }} {{ typeLabels[type] }} template</span>
      </div>
      <div class="actions">
        @if (!isNew && !template()?.isDefault) {
          <button mat-stroked-button (click)="setDefault()">Set as default</button>
        }
        @if (!isNew) {
          <button mat-stroked-button color="warn" (click)="deleteTemplate()">Delete</button>
        }
        <button mat-flat-button color="primary" (click)="save()">Save</button>
      </div>
    </div>

    <mat-form-field appearance="outline" class="full-width">
      <mat-label>Template name</mat-label>
      <input matInput [(ngModel)]="name" placeholder="e.g. Standard deal sheet" />
    </mat-form-field>

    <div class="editor-layout">
      <mat-card class="editor-card">
        <div class="editor-toolbar">
          <button mat-stroked-button [matMenuTriggerFor]="varsMenu">
            <mat-icon>data_object</mat-icon>
            Insert variable
          </button>
          <mat-menu #varsMenu="matMenu">
            @for (v of availableVariables; track v.key) {
              <button mat-menu-item (click)="insertVariable(v.key)">{{ v.label }}</button>
            }
          </mat-menu>
        </div>
        <textarea
          #bodyEditor
          class="body-editor"
          [(ngModel)]="bodyHtml"
          (ngModelChange)="onBodyChange()"
          spellcheck="false"
        ></textarea>
        <p class="hint">
          HTML + inline &lt;style&gt; — write text, styling, and an &lt;img&gt; for your logo directly. Loop over
          accessory lines with <code>{{ eachSyntaxHint }}</code> and conditionals with <code>{{ ifSyntaxHint }}</code>.
        </p>
      </mat-card>

      <mat-card class="preview-card">
        <h4>Live preview (approximate — real data is used when generated)</h4>
        <iframe [srcdoc]="previewHtml()" class="preview-frame" title="Template preview"></iframe>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .header > div:first-child {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .title {
        font-size: 18px;
        font-weight: 600;
      }
      .actions {
        display: flex;
        gap: 8px;
      }
      .full-width {
        width: 100%;
      }
      .editor-layout {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .editor-card,
      .preview-card {
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .editor-toolbar {
        display: flex;
      }
      .body-editor {
        width: 100%;
        min-height: 480px;
        font-family: 'Roboto Mono', monospace;
        font-size: 12px;
        line-height: 1.4;
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        resize: vertical;
      }
      .hint {
        font-size: 11px;
        color: rgba(0, 0, 0, 0.55);
      }
      .preview-frame {
        width: 100%;
        min-height: 480px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #fff;
      }
    `,
  ],
})
export class DocumentTemplateEditorComponent implements OnInit {
  @ViewChild('bodyEditor') bodyEditorRef?: ElementRef<HTMLTextAreaElement>;

  readonly typeLabels = DOCUMENT_TEMPLATE_TYPE_LABELS;
  readonly previewHtml = signal('');
  readonly template = signal<{ isDefault: boolean } | null>(null);
  readonly eachSyntaxHint = '{{#each accessories}}...{{/each}}';
  readonly ifSyntaxHint = '{{#if field}}...{{/if}}';

  isNew = true;
  type: DocumentTemplateType = DocumentTemplateType.DEAL_SHEET;
  name = '';
  bodyHtml = STARTER_BODY;
  availableVariables: DocumentTemplateVariable[] = [];

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private templateId = '';

  ngOnInit(): void {
    this.templateId = this.route.snapshot.paramMap.get('id') ?? 'new';
    this.isNew = this.templateId === 'new';

    if (this.isNew) {
      this.type = (this.route.snapshot.queryParamMap.get('type') as DocumentTemplateType) ?? DocumentTemplateType.DEAL_SHEET;
      this.availableVariables = this.variablesFor(this.type);
      this.updatePreview();
    } else {
      this.http
        .get<{ type: DocumentTemplateType; name: string; bodyHtml: string; isDefault: boolean }>(
          `${environment.apiUrl}/document-templates/${this.templateId}`,
        )
        .subscribe((data) => {
          this.type = data.type;
          this.name = data.name;
          this.bodyHtml = data.bodyHtml;
          this.template.set({ isDefault: data.isDefault });
          this.availableVariables = this.variablesFor(this.type);
          this.updatePreview();
        });
    }
  }

  private variablesFor(type: DocumentTemplateType): DocumentTemplateVariable[] {
    return [...COMMON_DOCUMENT_TEMPLATE_VARIABLES, ...DOCUMENT_TEMPLATE_VARIABLES[type]].filter((v) => !v.key.startsWith('#'));
  }

  insertVariable(key: string): void {
    const token = `{{${key}}}`;
    const textarea = this.bodyEditorRef?.nativeElement;
    if (!textarea) {
      this.bodyHtml += token;
      this.updatePreview();
      return;
    }
    const start = textarea.selectionStart ?? this.bodyHtml.length;
    const end = textarea.selectionEnd ?? this.bodyHtml.length;
    this.bodyHtml = this.bodyHtml.slice(0, start) + token + this.bodyHtml.slice(end);
    this.updatePreview();
    queueMicrotask(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    });
  }

  onBodyChange(): void {
    this.updatePreview();
  }

  private updatePreview(): void {
    let html = this.bodyHtml;
    html = html.replace(/\{\{#each\s+accessories\}\}([\s\S]*?)\{\{\/each\}\}/g, (_match, inner: string) =>
      inner.replace(/\{\{description\}\}/g, 'Mudflaps').replace(/\{\{price\}\}/g, '50.00'),
    );
    html = html.replace(/\{\{#if\s+[^}]+\}\}/g, '').replace(/\{\{\/if\}\}/g, '');
    html = html.replace(/\{\{([\w.]+)\}\}/g, (_match, key: string) => PREVIEW_SAMPLES[key] ?? `[${key}]`);
    this.previewHtml.set(html);
  }

  save(): void {
    if (!this.name.trim()) {
      this.snackBar.open('Give the template a name first', 'Dismiss', { duration: 3000 });
      return;
    }
    const request = this.isNew
      ? this.http.post(`${environment.apiUrl}/document-templates`, { type: this.type, name: this.name, bodyHtml: this.bodyHtml })
      : this.http.patch(`${environment.apiUrl}/document-templates/${this.templateId}`, { name: this.name, bodyHtml: this.bodyHtml });

    request.subscribe({
      next: () => {
        this.snackBar.open('Template saved', 'Dismiss', { duration: 2000 });
        this.back();
      },
      error: (err) => this.snackBar.open(err?.error?.message ?? 'Could not save template', 'Dismiss', { duration: 4000 }),
    });
  }

  setDefault(): void {
    this.http.post(`${environment.apiUrl}/document-templates/${this.templateId}/set-default`, {}).subscribe(() => {
      this.snackBar.open('Set as the default template for this document type', 'Dismiss', { duration: 2500 });
      this.template.set({ isDefault: true });
    });
  }

  deleteTemplate(): void {
    this.http.delete(`${environment.apiUrl}/document-templates/${this.templateId}`).subscribe(() => this.back());
  }

  back(): void {
    this.router.navigate(['/admin/settings']);
  }
}

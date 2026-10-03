import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import {
  CONSENT_TYPE_LABELS,
  ConsentType,
  SIGNATURE_DOC_TYPE_LABELS,
  SignatureDocType,
} from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface Consent { id: string; customerName: string; contactRef: string | null; consentType: ConsentType; granted: boolean; capturedAt: string; }
interface Signature { id: string; documentType: SignatureDocType; documentRef: string; signerName: string; signedAt: string; }

@Component({
  selector: 'app-compliance',
  imports: [DatePipe, FormsModule, MatButtonModule, MatButtonToggleModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatTableModule],
  template: `
    <h1>Compliance & E-Signature</h1>
    <div class="cols">
      <mat-card class="col">
        <h3>Capture consent</h3>
        <mat-form-field appearance="outline" class="full"><mat-label>Customer</mat-label><input matInput [(ngModel)]="consentForm.customerName" /></mat-form-field>
        <mat-form-field appearance="outline" class="full"><mat-label>Contact (email/phone)</mat-label><input matInput [(ngModel)]="consentForm.contactRef" /></mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Consent type</mat-label>
          <mat-select [(ngModel)]="consentForm.consentType">
            @for (t of consentTypes; track t) { <mat-option [value]="t">{{ consentTypeLabels[t] }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-button-toggle-group [(ngModel)]="consentForm.granted" class="grant">
          <mat-button-toggle [value]="true">Granted</mat-button-toggle>
          <mat-button-toggle [value]="false">Refused</mat-button-toggle>
        </mat-button-toggle-group>
        <button mat-flat-button color="primary" [disabled]="!consentForm.customerName" (click)="saveConsent()">Record consent</button>

        <h4>Recent consents</h4>
        <table mat-table [dataSource]="consents()" class="mat-elevation-z1">
          <ng-container matColumnDef="customer"><th mat-header-cell *matHeaderCellDef>Customer</th><td mat-cell *matCellDef="let c">{{ c.customerName }}</td></ng-container>
          <ng-container matColumnDef="type"><th mat-header-cell *matHeaderCellDef>Type</th><td mat-cell *matCellDef="let c">{{ consentTypeLabel(c.consentType) }}</td></ng-container>
          <ng-container matColumnDef="granted"><th mat-header-cell *matHeaderCellDef>Result</th><td mat-cell *matCellDef="let c"><mat-chip [class]="c.granted ? 'ok' : 'no'">{{ c.granted ? 'Granted' : 'Refused' }}</mat-chip></td></ng-container>
          <ng-container matColumnDef="at"><th mat-header-cell *matHeaderCellDef>When</th><td mat-cell *matCellDef="let c">{{ c.capturedAt | date: 'short' }}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="consentColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: consentColumns"></tr>
        </table>
      </mat-card>

      <mat-card class="col">
        <h3>Capture signature</h3>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Document type</mat-label>
          <mat-select [(ngModel)]="sigForm.documentType">
            @for (t of docTypes; track t) { <mat-option [value]="t">{{ docTypeLabels[t] }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full"><mat-label>Document reference</mat-label><input matInput [(ngModel)]="sigForm.documentRef" placeholder="e.g. DS-2026-00001" /></mat-form-field>
        <mat-form-field appearance="outline" class="full"><mat-label>Signer name</mat-label><input matInput [(ngModel)]="sigForm.signerName" /></mat-form-field>
        <canvas #pad class="pad" width="360" height="140"
          (pointerdown)="start($event)" (pointermove)="move($event)" (pointerup)="end()" (pointerleave)="end()"></canvas>
        <div class="pad-actions">
          <button mat-stroked-button (click)="clearPad()">Clear</button>
          <button mat-flat-button color="primary" [disabled]="!sigForm.documentRef || !sigForm.signerName || !hasInk()" (click)="saveSignature()">Save signature</button>
        </div>

        <h4>Recent signatures</h4>
        <table mat-table [dataSource]="signatures()" class="mat-elevation-z1">
          <ng-container matColumnDef="doc"><th mat-header-cell *matHeaderCellDef>Document</th><td mat-cell *matCellDef="let s">{{ docTypeLabel(s.documentType) }} · {{ s.documentRef }}</td></ng-container>
          <ng-container matColumnDef="signer"><th mat-header-cell *matHeaderCellDef>Signer</th><td mat-cell *matCellDef="let s">{{ s.signerName }}</td></ng-container>
          <ng-container matColumnDef="at"><th mat-header-cell *matHeaderCellDef>Signed</th><td mat-cell *matCellDef="let s">{{ s.signedAt | date: 'short' }}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="sigColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: sigColumns"></tr>
        </table>
      </mat-card>
    </div>
  `,
  styles: [`
    .cols { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
    .col { flex: 1; min-width: 380px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
    .full { width: 100%; }
    .grant { margin-bottom: 8px; }
    .pad { border: 1px dashed #999; border-radius: 6px; touch-action: none; background: #fafafa; }
    .pad-actions { display: flex; gap: 8px; }
    table { width: 100%; margin-top: 8px; }
    .ok { background: #e8f5e9; } .no { background: #fbe9e7; }
    h4 { margin: 12px 0 4px; }
  `],
})
export class ComplianceComponent implements OnInit, AfterViewInit {
  @ViewChild('pad') padRef!: ElementRef<HTMLCanvasElement>;
  readonly consents = signal<Consent[]>([]);
  readonly signatures = signal<Signature[]>([]);
  readonly consentColumns = ['customer', 'type', 'granted', 'at'];
  readonly sigColumns = ['doc', 'signer', 'at'];
  readonly consentTypes = Object.values(ConsentType);
  readonly docTypes = Object.values(SignatureDocType);
  readonly consentTypeLabels = CONSENT_TYPE_LABELS;
  readonly docTypeLabels = SIGNATURE_DOC_TYPE_LABELS;

  consentForm = { customerName: '', contactRef: '', consentType: ConsentType.MARKETING_EMAIL, granted: true };
  sigForm = { documentType: SignatureDocType.DEAL, documentRef: '', signerName: '' };

  private drawing = false;
  private inked = false;
  private ctx: CanvasRenderingContext2D | null = null;

  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  consentTypeLabel(t: ConsentType): string { return CONSENT_TYPE_LABELS[t]; }
  docTypeLabel(t: SignatureDocType): string { return SIGNATURE_DOC_TYPE_LABELS[t]; }

  ngOnInit(): void { this.load(); }

  ngAfterViewInit(): void {
    this.ctx = this.padRef.nativeElement.getContext('2d');
    if (this.ctx) {
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = 'round';
      this.ctx.strokeStyle = '#111';
    }
  }

  load(): void {
    this.http.get<Consent[]>(`${environment.apiUrl}/compliance/consents`).subscribe((d) => this.consents.set(d));
    this.http.get<Signature[]>(`${environment.apiUrl}/compliance/signatures`).subscribe((d) => this.signatures.set(d));
  }

  private point(e: PointerEvent): { x: number; y: number } {
    const rect = this.padRef.nativeElement.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  start(e: PointerEvent): void {
    if (!this.ctx) return;
    this.drawing = true;
    const p = this.point(e);
    this.ctx.beginPath();
    this.ctx.moveTo(p.x, p.y);
  }

  move(e: PointerEvent): void {
    if (!this.drawing || !this.ctx) return;
    const p = this.point(e);
    this.ctx.lineTo(p.x, p.y);
    this.ctx.stroke();
    this.inked = true;
  }

  end(): void { this.drawing = false; }

  hasInk(): boolean { return this.inked; }

  clearPad(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.padRef.nativeElement.width, this.padRef.nativeElement.height);
    this.inked = false;
  }

  saveConsent(): void {
    this.http.post(`${environment.apiUrl}/compliance/consents`, {
      customerName: this.consentForm.customerName,
      contactRef: this.consentForm.contactRef || undefined,
      consentType: this.consentForm.consentType,
      granted: this.consentForm.granted,
    }).subscribe(() => {
      this.snackBar.open('Consent recorded', 'Dismiss', { duration: 2500 });
      this.consentForm = { customerName: '', contactRef: '', consentType: ConsentType.MARKETING_EMAIL, granted: true };
      this.load();
    });
  }

  saveSignature(): void {
    const signatureData = this.padRef.nativeElement.toDataURL('image/png');
    this.http.post(`${environment.apiUrl}/compliance/signatures`, {
      documentType: this.sigForm.documentType,
      documentRef: this.sigForm.documentRef,
      signerName: this.sigForm.signerName,
      signatureData,
    }).subscribe(() => {
      this.snackBar.open('Signature captured', 'Dismiss', { duration: 2500 });
      this.sigForm = { documentType: SignatureDocType.DEAL, documentRef: '', signerName: '' };
      this.clearPad();
      this.load();
    });
  }
}

/** Mirrors the Prisma `CreditNoteStatus` enum — a credit note (refund/adjustment) raised against
 * a customer: DRAFT (editable) → ISSUED (numbered, sent) → APPLIED (offset against a balance);
 * CANCELLED voids a note that should not have been raised. */
export enum CreditNoteStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  APPLIED = 'APPLIED',
  CANCELLED = 'CANCELLED',
}

export const CREDIT_NOTE_STATUS_LABELS: Record<CreditNoteStatus, string> = {
  [CreditNoteStatus.DRAFT]: 'Draft',
  [CreditNoteStatus.ISSUED]: 'Issued',
  [CreditNoteStatus.APPLIED]: 'Applied',
  [CreditNoteStatus.CANCELLED]: 'Cancelled',
};

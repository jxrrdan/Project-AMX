export enum VhcRating {
  GREEN = 'GREEN',
  AMBER = 'AMBER',
  RED = 'RED',
}

export const VHC_RATING_COLOURS: Record<VhcRating, string> = {
  [VhcRating.GREEN]: '#2E7D32',
  [VhcRating.AMBER]: '#EF6C00',
  [VhcRating.RED]: '#C62828',
};

/** DRAFT: technician still adding items. COMPLETE: technician has signed off — gate to send.
 * SENT: emailed, awaiting customer responses. CLOSED: every item has been responded to. */
export enum VhcInspectionStatus {
  DRAFT = 'DRAFT',
  COMPLETE = 'COMPLETE',
  SENT = 'SENT',
  CLOSED = 'CLOSED',
}

export const VHC_INSPECTION_STATUS_LABELS: Record<VhcInspectionStatus, string> = {
  [VhcInspectionStatus.DRAFT]: 'Draft',
  [VhcInspectionStatus.COMPLETE]: 'Signed off',
  [VhcInspectionStatus.SENT]: 'Sent to customer',
  [VhcInspectionStatus.CLOSED]: 'Closed',
};

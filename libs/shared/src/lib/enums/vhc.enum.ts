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

export const VHC_RATING_LABELS: Record<VhcRating, string> = {
  [VhcRating.GREEN]: 'Passed',
  [VhcRating.AMBER]: 'Amber — advisory',
  [VhcRating.RED]: 'Red — action required',
};

/** DRAFT: technician still adding items. RECORDED: technician has finished recording/videoing and
 * signed off — gates the report from being sent, and notifies the job card's assigned service
 * advisor to review, price up, and action it. SENT: advisor emailed the report to the customer.
 * CONTACTED: advisor rang the customer instead. CLOSED: every item has been resolved. */
export enum VhcInspectionStatus {
  DRAFT = 'DRAFT',
  RECORDED = 'RECORDED',
  SENT = 'SENT',
  CONTACTED = 'CONTACTED',
  CLOSED = 'CLOSED',
}

export const VHC_INSPECTION_STATUS_LABELS: Record<VhcInspectionStatus, string> = {
  [VhcInspectionStatus.DRAFT]: 'Draft',
  [VhcInspectionStatus.RECORDED]: 'Recorded — awaiting advisor review',
  [VhcInspectionStatus.SENT]: 'Sent to customer',
  [VhcInspectionStatus.CONTACTED]: 'Customer contacted by phone',
  [VhcInspectionStatus.CLOSED]: 'Closed',
};

export enum VhcContactMethod {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
}

export const VHC_CONTACT_METHOD_LABELS: Record<VhcContactMethod, string> = {
  [VhcContactMethod.EMAIL]: 'Emailed',
  [VhcContactMethod.PHONE]: 'Phoned',
};

/** PENDING: awaiting a decision. APPROVED: customer wants the work done — spawns a follow-up job.
 * DECLINED: customer doesn't want it. DEFERRED: held over for a future visit, not declined outright. */
export enum VhcItemResponseStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  DEFERRED = 'DEFERRED',
}

export const VHC_ITEM_RESPONSE_LABELS: Record<VhcItemResponseStatus, string> = {
  [VhcItemResponseStatus.PENDING]: 'Awaiting response',
  [VhcItemResponseStatus.APPROVED]: 'Approved',
  [VhcItemResponseStatus.DECLINED]: 'Declined',
  [VhcItemResponseStatus.DEFERRED]: 'Deferred',
};

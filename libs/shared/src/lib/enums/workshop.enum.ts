export enum JobType {
  PDI = 'PDI',
  SERVICE = 'SERVICE',
  REPAIR = 'REPAIR',
  WARRANTY = 'WARRANTY',
  MOT = 'MOT',
}

export const JOB_TYPE_COLOURS: Record<JobType, string> = {
  [JobType.PDI]: '#0066B1',
  [JobType.SERVICE]: '#2E7D32',
  [JobType.REPAIR]: '#C62828',
  [JobType.WARRANTY]: '#6A1B9A',
  [JobType.MOT]: '#EF6C00',
};

/** The skill/specialism a job requires — drives technician capacity planning, independent of JobType. */
export enum JobCategory {
  MECHANICAL = 'MECHANICAL',
  EV = 'EV',
  DIAGNOSTICS = 'DIAGNOSTICS',
  BODYSHOP = 'BODYSHOP',
  TYRES_AND_ALIGNMENT = 'TYRES_AND_ALIGNMENT',
  MOT_TESTING = 'MOT_TESTING',
  VALETING = 'VALETING',
  GENERAL = 'GENERAL',
}

export const JOB_CATEGORY_LABELS: Record<JobCategory, string> = {
  [JobCategory.MECHANICAL]: 'Mechanical',
  [JobCategory.EV]: 'EV / Hybrid',
  [JobCategory.DIAGNOSTICS]: 'Diagnostics',
  [JobCategory.BODYSHOP]: 'Bodyshop',
  [JobCategory.TYRES_AND_ALIGNMENT]: 'Tyres & Alignment',
  [JobCategory.MOT_TESTING]: 'MOT Testing',
  [JobCategory.VALETING]: 'Valeting',
  [JobCategory.GENERAL]: 'General',
};

/** Who ultimately pays for a job card — decides invoicing routing (see AftersalesInvoiceService). */
export enum JobBillingType {
  RETAIL = 'RETAIL',
  WARRANTY = 'WARRANTY',
  INTERNAL = 'INTERNAL',
}

export const JOB_BILLING_TYPE_LABELS: Record<JobBillingType, string> = {
  [JobBillingType.RETAIL]: 'Retail — bill customer',
  [JobBillingType.WARRANTY]: 'Warranty — claim from OEM',
  [JobBillingType.INTERNAL]: 'Internal — dealer cost',
};

export enum JobCardStatus {
  CREATED = 'CREATED',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_PARTS = 'AWAITING_PARTS',
  COMPLETE = 'COMPLETE',
  INVOICED = 'INVOICED',
}

export const JOB_CARD_WORKFLOW: JobCardStatus[] = [
  JobCardStatus.CREATED,
  JobCardStatus.SCHEDULED,
  JobCardStatus.IN_PROGRESS,
  JobCardStatus.AWAITING_PARTS,
  JobCardStatus.COMPLETE,
  JobCardStatus.INVOICED,
];

export enum ServiceBookingStatus {
  REQUESTED = 'REQUESTED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

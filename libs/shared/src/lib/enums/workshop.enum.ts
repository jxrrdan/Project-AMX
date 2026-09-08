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

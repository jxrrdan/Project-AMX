export enum ContactStatus {
  PROSPECT = 'PROSPECT',
  CUSTOMER = 'CUSTOMER',
}

export enum LeadStage {
  ENQUIRY = 'ENQUIRY',
  CONTACTED = 'CONTACTED',
  TEST_DRIVE = 'TEST_DRIVE',
  OFFER = 'OFFER',
  RESERVED = 'RESERVED',
  SOLD = 'SOLD',
  LOST = 'LOST',
}

export const LEAD_PIPELINE_COLUMNS: LeadStage[] = [
  LeadStage.ENQUIRY,
  LeadStage.CONTACTED,
  LeadStage.TEST_DRIVE,
  LeadStage.OFFER,
  LeadStage.RESERVED,
  LeadStage.SOLD,
  LeadStage.LOST,
];

export enum LeadSource {
  WEBSITE_FORM = 'WEBSITE_FORM',
  BMW_CRM = 'BMW_CRM',
  EMAIL = 'EMAIL',
  MANUAL = 'MANUAL',
  CHATBOT = 'CHATBOT',
  PHONE = 'PHONE',
}

export enum CrmActivityType {
  CALL = 'CALL',
  MEETING = 'MEETING',
  NOTE = 'NOTE',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  STAGE_CHANGE = 'STAGE_CHANGE',
}

export enum TemplateCategory {
  INITIAL_ENQUIRY = 'INITIAL_ENQUIRY',
  FOLLOW_UP = 'FOLLOW_UP',
  TEST_DRIVE_CONFIRMATION = 'TEST_DRIVE_CONFIRMATION',
  OFFER_LETTER = 'OFFER_LETTER',
  LOST_SALE_RECOVERY = 'LOST_SALE_RECOVERY',
  SERVICE_REMINDER = 'SERVICE_REMINDER',
  OTHER = 'OTHER',
}

export enum EmailStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  OPENED = 'OPENED',
  CLICKED = 'CLICKED',
  REPLIED = 'REPLIED',
  FAILED = 'FAILED',
}

export enum SmsStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  REPLIED = 'REPLIED',
}

export enum DocumentTemplateType {
  SALES_INVOICE = 'SALES_INVOICE',
  PART_EXCHANGE_RECEIPT = 'PART_EXCHANGE_RECEIPT',
  SERVICE_ESTIMATE = 'SERVICE_ESTIMATE',
  HANDOVER_DOCUMENT = 'HANDOVER_DOCUMENT',
  DEAL_SHEET = 'DEAL_SHEET',
  AFTERSALES_INVOICE = 'AFTERSALES_INVOICE',
}

export enum WorkflowTrigger {
  MANUAL = 'MANUAL',
  LEAD_STAGE_ENTERED = 'LEAD_STAGE_ENTERED',
  CONTACT_CREATED = 'CONTACT_CREATED',
  NO_ACTIVITY_DAYS = 'NO_ACTIVITY_DAYS',
}

export enum WorkflowActionType {
  SEND_EMAIL = 'SEND_EMAIL',
  SEND_SMS = 'SEND_SMS',
  CREATE_TASK = 'CREATE_TASK',
  CHANGE_LEAD_STAGE = 'CHANGE_LEAD_STAGE',
  ADD_TAG = 'ADD_TAG',
  /** Branches the workflow to a different step rather than performing an action of its own. */
  CONDITION = 'CONDITION',
}

/** Fields a CONDITION step can branch on — deliberately limited to what this system actually tracks. */
export enum WorkflowConditionField {
  LEAD_STAGE = 'LEAD_STAGE',
  CONTACT_HAS_EMAIL = 'CONTACT_HAS_EMAIL',
  CONTACT_HAS_PHONE = 'CONTACT_HAS_PHONE',
  CONTACT_GDPR_CONSENT = 'CONTACT_GDPR_CONSENT',
}

export enum WorkflowConditionOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
}

/**
 * Shape of `WorkflowStep.actionConfig` when `actionType` is CONDITION. `onTrueStep`/`onFalseStep`
 * are the `sortOrder` of the step to jump to next — not the array index — so branches can skip
 * forward, loop back, or terminate (a step with no match at that sortOrder simply completes the
 * enrolment, the same way running off the end of a purely sequential workflow already does).
 */
export interface WorkflowConditionConfig {
  field: WorkflowConditionField;
  operator: WorkflowConditionOperator;
  /** Ignored for boolean fields (CONTACT_HAS_EMAIL/CONTACT_HAS_PHONE/CONTACT_GDPR_CONSENT), which compare against "true"/"false". */
  value?: string;
  onTrueStep: number;
  onFalseStep: number;
}

export enum WorkflowEnrollmentStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  UNENROLLED = 'UNENROLLED',
}

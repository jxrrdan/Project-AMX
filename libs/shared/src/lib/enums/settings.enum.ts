import { DocumentTemplateType } from './crm.enum';

/** Mirrors the Prisma `ConfigScope` enum — which of the three tenancy levels a shared piece of
 * config (document template, action trigger) belongs to. Resolution always prefers the most
 * specific: DEALER, then FRANCHISE, then GROUP. */
export enum ConfigScope {
  GROUP = 'GROUP',
  FRANCHISE = 'FRANCHISE',
  DEALER = 'DEALER',
}

export const CONFIG_SCOPE_LABELS: Record<ConfigScope, string> = {
  [ConfigScope.DEALER]: 'This outlet only',
  [ConfigScope.FRANCHISE]: 'Whole franchise/brand',
  [ConfigScope.GROUP]: 'Whole dealer group',
};

export const DOCUMENT_TEMPLATE_TYPE_LABELS: Record<DocumentTemplateType, string> = {
  [DocumentTemplateType.SALES_INVOICE]: 'Sales invoice',
  [DocumentTemplateType.PART_EXCHANGE_RECEIPT]: 'Part-exchange receipt',
  [DocumentTemplateType.SERVICE_ESTIMATE]: 'Service estimate',
  [DocumentTemplateType.HANDOVER_DOCUMENT]: 'Handover document',
  [DocumentTemplateType.DEAL_SHEET]: 'Used car deal sheet',
  [DocumentTemplateType.AFTERSALES_INVOICE]: 'Aftersales (workshop) invoice',
  [DocumentTemplateType.CUSTOMER_SUPPORT_INVOICE]: 'Customer support invoice',
  [DocumentTemplateType.NEW_CAR_SALE]: 'New car sale confirmation',
};

export interface DocumentTemplateVariable {
  key: string;
  label: string;
}

/** Every dealer/document template is rendered with this common set, regardless of type. */
export const COMMON_DOCUMENT_TEMPLATE_VARIABLES: DocumentTemplateVariable[] = [
  { key: 'dealerName', label: 'Dealer name' },
  { key: 'dealerAddress', label: 'Dealer address' },
  { key: 'dealerLogoUrl', label: 'Dealer logo (image URL)' },
  { key: 'dealerVatNumber', label: 'Dealer VAT number' },
  { key: 'dealerInvoiceFooterNote', label: 'Dealer invoice footer note' },
  { key: 'documentDate', label: "Today's date" },
];

/** Type-specific placeholders available in the template editor's "insert variable" picker. */
export const DOCUMENT_TEMPLATE_VARIABLES: Record<DocumentTemplateType, DocumentTemplateVariable[]> = {
  [DocumentTemplateType.DEAL_SHEET]: [
    { key: 'vehicle.reg', label: 'Vehicle registration' },
    { key: 'vehicle.make', label: 'Vehicle make' },
    { key: 'vehicle.model', label: 'Vehicle model' },
    { key: 'sellingPrice', label: 'Selling price' },
    { key: 'partExchangeValue', label: 'Part-exchange value' },
    { key: 'financeContribution', label: 'Finance contribution' },
    { key: 'accessoriesTotal', label: 'Accessories total' },
    { key: 'grossProfit', label: 'Gross profit' },
    { key: '#each accessories', label: 'Accessory line loop (description / price)' },
  ],
  [DocumentTemplateType.SALES_INVOICE]: [
    { key: 'invoiceNumber', label: 'Invoice number' },
    { key: 'customerName', label: 'Customer name' },
    { key: 'vehicle.reg', label: 'Vehicle registration' },
    { key: 'totalAmount', label: 'Total amount' },
  ],
  [DocumentTemplateType.PART_EXCHANGE_RECEIPT]: [
    { key: 'customerName', label: 'Customer name' },
    { key: 'vehicle.reg', label: 'Part-exchange vehicle registration' },
    { key: 'agreedValue', label: 'Agreed value' },
  ],
  [DocumentTemplateType.SERVICE_ESTIMATE]: [
    { key: 'customerName', label: 'Customer name' },
    { key: 'vehicleReg', label: 'Vehicle registration' },
    { key: 'estimatedTotal', label: 'Estimated total' },
  ],
  [DocumentTemplateType.HANDOVER_DOCUMENT]: [
    { key: 'customerName', label: 'Customer name' },
    { key: 'vehicle.reg', label: 'Vehicle registration' },
    { key: 'vehicle.model', label: 'Vehicle model' },
    { key: 'handoverDate', label: 'Handover date' },
    { key: 'salesExecutiveName', label: 'Sales executive name' },
  ],
  [DocumentTemplateType.AFTERSALES_INVOICE]: [
    { key: 'invoiceNumber', label: 'Invoice number' },
    { key: 'customerName', label: 'Customer name' },
    { key: 'vehicleReg', label: 'Vehicle registration' },
    { key: 'jobType', label: 'Job type' },
    { key: 'labourTotal', label: 'Labour total' },
    { key: 'partsTotal', label: 'Parts total' },
    { key: 'vatAmount', label: 'VAT amount' },
    { key: 'totalAmount', label: 'Total amount' },
    { key: '#each parts', label: 'Part line loop (description / quantity / price)' },
  ],
  [DocumentTemplateType.CUSTOMER_SUPPORT_INVOICE]: [
    { key: 'invoiceNumber', label: 'Invoice number' },
    { key: 'customerName', label: 'Customer name' },
    { key: 'description', label: 'Charge description' },
    { key: 'amount', label: 'Amount (excl. VAT)' },
    { key: 'vatAmount', label: 'VAT amount' },
    { key: 'totalAmount', label: 'Total amount' },
  ],
  [DocumentTemplateType.NEW_CAR_SALE]: [
    { key: 'vehicle.vin', label: 'Vehicle VIN' },
    { key: 'vehicle.model', label: 'Vehicle model' },
    { key: 'customerName', label: 'Customer name' },
    { key: 'saleModel', label: 'Sale model (Retail/Agency)' },
    { key: 'sellingPrice', label: 'Selling price' },
    { key: 'agencyCommission', label: 'Agency commission (agency sales only)' },
    { key: 'tradeIn.agreedValue', label: 'Trade-in agreed value (if any)' },
  ],
};

/** Mirrors the Prisma `ActionTriggerPoint` enum — a user-facing lookup function a business
 * systems manager can wire up to also call an external API (see ActionTriggersService). */
export enum ActionTriggerPoint {
  USED_VEHICLE_REG_LOOKUP = 'USED_VEHICLE_REG_LOOKUP',
}

export const ACTION_TRIGGER_POINT_LABELS: Record<ActionTriggerPoint, string> = {
  [ActionTriggerPoint.USED_VEHICLE_REG_LOOKUP]: 'Used car search by registration',
};

/** Mirrors the Prisma `NotificationChannel` enum. IN_APP always writes a row the bell can show;
 * EMAIL/SMS additionally deliver via EmailService/SmsService (console-log adapters locally, real
 * SES/Twilio in production — same pattern as everywhere else in this app). PUSH has no adapter at
 * all yet — there's no push infra (FCM/APNs/web-push) in this codebase — so it logs a warning
 * rather than pretending to deliver. */
export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  PUSH = 'PUSH',
}

/** Mirrors the Prisma `BatchJobStatus` enum. */
export enum BatchJobStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export enum BatchJobName {
  STALE_LEAD_ESCALATION = 'STALE_LEAD_ESCALATION',
  PARTS_REORDER_ALERT = 'PARTS_REORDER_ALERT',
  COURTESY_FLEET_EXPIRY_SWEEP = 'COURTESY_FLEET_EXPIRY_SWEEP',
}

export interface BatchJobDefinition {
  name: BatchJobName;
  label: string;
  description: string;
  schedule: string;
}

export const BATCH_JOB_DEFINITIONS: BatchJobDefinition[] = [
  {
    name: BatchJobName.STALE_LEAD_ESCALATION,
    label: 'Stale lead escalation',
    description: 'Notifies the assigned salesperson about open leads with no activity in 7+ days.',
    schedule: 'Nightly at 02:00',
  },
  {
    name: BatchJobName.PARTS_REORDER_ALERT,
    label: 'Parts reorder alert',
    description: 'Notifies parts managers about stock at or below its reorder level.',
    schedule: 'Nightly at 02:15',
  },
  {
    name: BatchJobName.COURTESY_FLEET_EXPIRY_SWEEP,
    label: 'Courtesy fleet expiry sweep',
    description: 'Notifies general managers about courtesy vehicles due for MOT/insurance/tax renewal within 30 days.',
    schedule: 'Monthly, 1st at 03:00',
  },
];

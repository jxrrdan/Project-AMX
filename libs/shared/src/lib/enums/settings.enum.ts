import { DocumentTemplateType } from './crm.enum';

export const DOCUMENT_TEMPLATE_TYPE_LABELS: Record<DocumentTemplateType, string> = {
  [DocumentTemplateType.SALES_INVOICE]: 'Sales invoice',
  [DocumentTemplateType.PART_EXCHANGE_RECEIPT]: 'Part-exchange receipt',
  [DocumentTemplateType.SERVICE_ESTIMATE]: 'Service estimate',
  [DocumentTemplateType.HANDOVER_DOCUMENT]: 'Handover document',
  [DocumentTemplateType.DEAL_SHEET]: 'Used car deal sheet',
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
};

/** Mirrors the Prisma `NotificationChannel` enum. */
export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
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

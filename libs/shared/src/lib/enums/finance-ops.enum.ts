// Enums for the aftersales/finance operations modules (cashiering, account customers, service
// plans, compliance, parts depth) — each mirrors the matching Prisma enum.

// --- Cashiering (#1) --------------------------------------------------------
export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: 'Cash',
  [PaymentMethod.CARD]: 'Card',
  [PaymentMethod.BANK_TRANSFER]: 'Bank transfer',
  [PaymentMethod.CHEQUE]: 'Cheque',
};

export enum PaymentKind {
  PAYMENT = 'PAYMENT',
  DEPOSIT = 'DEPOSIT',
  REFUND = 'REFUND',
}

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  [PaymentKind.PAYMENT]: 'Payment',
  [PaymentKind.DEPOSIT]: 'Deposit',
  [PaymentKind.REFUND]: 'Refund',
};

// --- Account customers / AR (#2) --------------------------------------------
export enum AccountTransactionType {
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  CREDIT = 'CREDIT',
}

export const ACCOUNT_TRANSACTION_TYPE_LABELS: Record<AccountTransactionType, string> = {
  [AccountTransactionType.INVOICE]: 'Invoice',
  [AccountTransactionType.PAYMENT]: 'Payment',
  [AccountTransactionType.CREDIT]: 'Credit',
};

// --- Service plans & reminders (#3) -----------------------------------------
export enum ServiceReminderType {
  MOT = 'MOT',
  SERVICE = 'SERVICE',
}

export const SERVICE_REMINDER_TYPE_LABELS: Record<ServiceReminderType, string> = {
  [ServiceReminderType.MOT]: 'MOT',
  [ServiceReminderType.SERVICE]: 'Service',
};

// --- Online booking / customer portal (#4) ----------------------------------
export enum OnlineBookingStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  SCHEDULED = 'SCHEDULED',
  DECLINED = 'DECLINED',
}

export const ONLINE_BOOKING_STATUS_LABELS: Record<OnlineBookingStatus, string> = {
  [OnlineBookingStatus.NEW]: 'New',
  [OnlineBookingStatus.CONTACTED]: 'Contacted',
  [OnlineBookingStatus.SCHEDULED]: 'Scheduled',
  [OnlineBookingStatus.DECLINED]: 'Declined',
};

// --- Compliance & e-signature (#7) ------------------------------------------
export enum ConsentType {
  MARKETING_EMAIL = 'MARKETING_EMAIL',
  MARKETING_SMS = 'MARKETING_SMS',
  DATA_PROCESSING = 'DATA_PROCESSING',
  FINANCE_IDD = 'FINANCE_IDD',
}

export const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  [ConsentType.MARKETING_EMAIL]: 'Marketing — email',
  [ConsentType.MARKETING_SMS]: 'Marketing — SMS',
  [ConsentType.DATA_PROCESSING]: 'Data processing (GDPR)',
  [ConsentType.FINANCE_IDD]: 'Finance IDD / Consumer Duty',
};

export enum SignatureDocType {
  DEAL = 'DEAL',
  FINANCE_AGREEMENT = 'FINANCE_AGREEMENT',
  SERVICE_AUTH = 'SERVICE_AUTH',
  GENERAL = 'GENERAL',
}

export const SIGNATURE_DOC_TYPE_LABELS: Record<SignatureDocType, string> = {
  [SignatureDocType.DEAL]: 'Deal / order',
  [SignatureDocType.FINANCE_AGREEMENT]: 'Finance agreement',
  [SignatureDocType.SERVICE_AUTH]: 'Service authorisation',
  [SignatureDocType.GENERAL]: 'General',
};

// --- Parts depth (#8) -------------------------------------------------------
export enum StockCountStatus {
  OPEN = 'OPEN',
  COMPLETED = 'COMPLETED',
}

export const STOCK_COUNT_STATUS_LABELS: Record<StockCountStatus, string> = {
  [StockCountStatus.OPEN]: 'Open',
  [StockCountStatus.COMPLETED]: 'Completed',
};

export enum BackorderStatus {
  OUTSTANDING = 'OUTSTANDING',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED',
}

export const BACKORDER_STATUS_LABELS: Record<BackorderStatus, string> = {
  [BackorderStatus.OUTSTANDING]: 'Outstanding',
  [BackorderStatus.RECEIVED]: 'Received',
  [BackorderStatus.CANCELLED]: 'Cancelled',
};

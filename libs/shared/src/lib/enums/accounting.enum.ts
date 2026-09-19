export enum AccountingProvider {
  XERO = 'XERO',
  SAGE = 'SAGE',
  QUICKBOOKS = 'QUICKBOOKS',
  CSV = 'CSV',
}

export enum AccountingTxnType {
  SALES_INVOICE = 'SALES_INVOICE',
  CREDIT_NOTE = 'CREDIT_NOTE',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  PAYMENT = 'PAYMENT',
  FI_COMMISSION = 'FI_COMMISSION',
}

export enum AccountingSyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

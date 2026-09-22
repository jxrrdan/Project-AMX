export enum NominalAccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export const NOMINAL_ACCOUNT_TYPE_LABELS: Record<NominalAccountType, string> = {
  [NominalAccountType.ASSET]: 'Asset',
  [NominalAccountType.LIABILITY]: 'Liability',
  [NominalAccountType.EQUITY]: 'Equity',
  [NominalAccountType.INCOME]: 'Income',
  [NominalAccountType.EXPENSE]: 'Expense',
};

/** UK VAT liability categories. See VAT_RATES below for the single source of rate percentages —
 * every service that calculates VAT (aftersales invoicing, customer invoicing, supplier invoices,
 * the VAT return) reads from here rather than hardcoding a rate. */
export enum VatCode {
  STANDARD = 'STANDARD',
  REDUCED = 'REDUCED',
  ZERO = 'ZERO',
  EXEMPT = 'EXEMPT',
  OUTSIDE_SCOPE = 'OUTSIDE_SCOPE',
}

export const VAT_CODE_LABELS: Record<VatCode, string> = {
  [VatCode.STANDARD]: 'Standard (20%)',
  [VatCode.REDUCED]: 'Reduced (5%)',
  [VatCode.ZERO]: 'Zero-rated (0%)',
  [VatCode.EXEMPT]: 'Exempt',
  [VatCode.OUTSIDE_SCOPE]: 'Outside the scope of VAT',
};

/** Current UK VAT rates as fractions (0.2 = 20%) — the single source every VAT calculation in this
 * app reads from. Update here, not in individual services, if HMRC changes a rate. */
export const VAT_RATES: Record<VatCode, number> = {
  [VatCode.STANDARD]: 0.2,
  [VatCode.REDUCED]: 0.05,
  [VatCode.ZERO]: 0,
  [VatCode.EXEMPT]: 0,
  [VatCode.OUTSIDE_SCOPE]: 0,
};

export enum JournalSourceType {
  AFTERSALES_INVOICE = 'AFTERSALES_INVOICE',
  CUSTOMER_INVOICE = 'CUSTOMER_INVOICE',
  SUPPLIER_INVOICE = 'SUPPLIER_INVOICE',
  MANUFACTURER_PAYMENT = 'MANUFACTURER_PAYMENT',
  VEHICLE_SALE = 'VEHICLE_SALE',
  MANUAL = 'MANUAL',
}

export const JOURNAL_SOURCE_TYPE_LABELS: Record<JournalSourceType, string> = {
  [JournalSourceType.AFTERSALES_INVOICE]: 'Aftersales invoice',
  [JournalSourceType.CUSTOMER_INVOICE]: 'Customer invoice',
  [JournalSourceType.SUPPLIER_INVOICE]: 'Supplier invoice',
  [JournalSourceType.MANUFACTURER_PAYMENT]: 'Manufacturer payment',
  [JournalSourceType.VEHICLE_SALE]: 'Vehicle sale',
  [JournalSourceType.MANUAL]: 'Manual journal',
};

export enum SupplierInvoiceStatus {
  DRAFT = 'DRAFT',
  MATCHED = 'MATCHED',
  DISCREPANCY = 'DISCREPANCY',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
}

export const SUPPLIER_INVOICE_STATUS_LABELS: Record<SupplierInvoiceStatus, string> = {
  [SupplierInvoiceStatus.DRAFT]: 'Draft',
  [SupplierInvoiceStatus.MATCHED]: 'Matched',
  [SupplierInvoiceStatus.DISCREPANCY]: 'Discrepancy',
  [SupplierInvoiceStatus.APPROVED]: 'Approved for payment',
  [SupplierInvoiceStatus.PAID]: 'Paid',
};

export enum ManufacturerPaymentBatchStatus {
  RECEIVED = 'RECEIVED',
  RECONCILED = 'RECONCILED',
  DISCREPANCY = 'DISCREPANCY',
  POSTED = 'POSTED',
}

export const MANUFACTURER_PAYMENT_BATCH_STATUS_LABELS: Record<ManufacturerPaymentBatchStatus, string> = {
  [ManufacturerPaymentBatchStatus.RECEIVED]: 'Received',
  [ManufacturerPaymentBatchStatus.RECONCILED]: 'Reconciled',
  [ManufacturerPaymentBatchStatus.DISCREPANCY]: 'Discrepancy',
  [ManufacturerPaymentBatchStatus.POSTED]: 'Posted to ledger',
};

export enum VatReturnStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
}

export const VAT_RETURN_STATUS_LABELS: Record<VatReturnStatus, string> = {
  [VatReturnStatus.DRAFT]: 'Draft',
  [VatReturnStatus.SUBMITTED]: 'Submitted to HMRC',
};

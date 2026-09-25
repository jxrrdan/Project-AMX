export enum PaymentMethod {
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CARD]: 'Card',
  [PaymentMethod.BANK_TRANSFER]: 'Bank transfer',
  [PaymentMethod.CASH]: 'Cash',
};

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: 'Pending',
  [PaymentStatus.SUCCEEDED]: 'Paid',
  [PaymentStatus.FAILED]: 'Failed',
};

export enum PaymentSourceType {
  AFTERSALES_INVOICE = 'AFTERSALES_INVOICE',
  CUSTOMER_INVOICE = 'CUSTOMER_INVOICE',
}

export const PAYMENT_SOURCE_TYPE_LABELS: Record<PaymentSourceType, string> = {
  [PaymentSourceType.AFTERSALES_INVOICE]: 'Aftersales invoice',
  [PaymentSourceType.CUSTOMER_INVOICE]: 'Customer invoice',
};

export enum BankLineStatus {
  UNMATCHED = 'UNMATCHED',
  MATCHED = 'MATCHED',
}

export const BANK_LINE_STATUS_LABELS: Record<BankLineStatus, string> = {
  [BankLineStatus.UNMATCHED]: 'Unmatched',
  [BankLineStatus.MATCHED]: 'Matched',
};

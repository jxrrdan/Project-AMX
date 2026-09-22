import { NominalAccountType, VatCode } from '@project-amx/shared';

/** Nominal codes every other service posts against by name, not by hunting up an id first —
 * see LedgerService.post(). Keeping these as named constants means a typo is a compile error
 * instead of a silent mis-post to the wrong account. */
export const CONTROL_ACCOUNT_CODES = {
  VEHICLE_STOCK: '1000',
  PARTS_STOCK: '1100',
  DEBTORS_CONTROL: '1200',
  VAT_INPUT: '1250',
  BANK: '1300',
  CREDITORS_CONTROL: '2000',
  VAT_OUTPUT: '2200',
  RETAINED_EARNINGS: '3000',
  VEHICLE_SALES: '4000',
  AFTERSALES_LABOUR: '4100',
  AFTERSALES_PARTS: '4200',
  FI_COMMISSION: '4300',
  MANUFACTURER_WARRANTY_INCOME: '4400',
  COST_OF_VEHICLE_SALES: '5000',
  PARTS_PURCHASES: '5100',
  OVERHEADS: '5200',
} as const;

interface DefaultAccount {
  code: string;
  name: string;
  type: NominalAccountType;
  isControlAccount?: boolean;
  defaultVatCode?: VatCode;
}

/** A standard UK dealer chart of accounts — seeded lazily (see LedgerService.ensureChartOfAccounts)
 * the first time a dealer's ledger is posted to or viewed, rather than at dealer creation, so
 * dealers that never touch the ledger never carry rows for it. */
export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccount[] = [
  { code: CONTROL_ACCOUNT_CODES.VEHICLE_STOCK, name: 'Vehicle Stock', type: NominalAccountType.ASSET, isControlAccount: true },
  { code: CONTROL_ACCOUNT_CODES.PARTS_STOCK, name: 'Parts Stock', type: NominalAccountType.ASSET, isControlAccount: true },
  { code: CONTROL_ACCOUNT_CODES.DEBTORS_CONTROL, name: 'Debtors Control', type: NominalAccountType.ASSET, isControlAccount: true },
  { code: CONTROL_ACCOUNT_CODES.VAT_INPUT, name: 'VAT Input (Recoverable)', type: NominalAccountType.ASSET, isControlAccount: true },
  { code: CONTROL_ACCOUNT_CODES.BANK, name: 'Bank Current Account', type: NominalAccountType.ASSET },
  { code: CONTROL_ACCOUNT_CODES.CREDITORS_CONTROL, name: 'Creditors Control', type: NominalAccountType.LIABILITY, isControlAccount: true },
  { code: CONTROL_ACCOUNT_CODES.VAT_OUTPUT, name: 'VAT Output', type: NominalAccountType.LIABILITY, isControlAccount: true },
  { code: CONTROL_ACCOUNT_CODES.RETAINED_EARNINGS, name: 'Retained Earnings', type: NominalAccountType.EQUITY },
  { code: CONTROL_ACCOUNT_CODES.VEHICLE_SALES, name: 'Vehicle Sales', type: NominalAccountType.INCOME, defaultVatCode: VatCode.STANDARD },
  { code: CONTROL_ACCOUNT_CODES.AFTERSALES_LABOUR, name: 'Aftersales Labour', type: NominalAccountType.INCOME, defaultVatCode: VatCode.STANDARD },
  { code: CONTROL_ACCOUNT_CODES.AFTERSALES_PARTS, name: 'Aftersales Parts', type: NominalAccountType.INCOME, defaultVatCode: VatCode.STANDARD },
  { code: CONTROL_ACCOUNT_CODES.FI_COMMISSION, name: 'F&I Commission', type: NominalAccountType.INCOME, defaultVatCode: VatCode.STANDARD },
  {
    code: CONTROL_ACCOUNT_CODES.MANUFACTURER_WARRANTY_INCOME,
    name: 'Manufacturer Warranty Income',
    type: NominalAccountType.INCOME,
    defaultVatCode: VatCode.OUTSIDE_SCOPE,
  },
  { code: CONTROL_ACCOUNT_CODES.COST_OF_VEHICLE_SALES, name: 'Cost of Vehicle Sales', type: NominalAccountType.EXPENSE },
  { code: CONTROL_ACCOUNT_CODES.PARTS_PURCHASES, name: 'Parts Purchases', type: NominalAccountType.EXPENSE, defaultVatCode: VatCode.STANDARD },
  { code: CONTROL_ACCOUNT_CODES.OVERHEADS, name: 'General Overheads', type: NominalAccountType.EXPENSE, defaultVatCode: VatCode.STANDARD },
];

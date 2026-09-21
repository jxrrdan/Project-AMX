/**
 * One entry per licensable AMS module (Feature Spec v3.1). Mirrors the Prisma `ModuleKey` enum —
 * kept independent so the Angular app never needs @prisma/client as a dependency.
 */
export enum ModuleKey {
  NEW_CAR_PDI = 'NEW_CAR_PDI',
  WORKSHOP = 'WORKSHOP',
  PARTS = 'PARTS',
  USED_CARS = 'USED_CARS',
  WARRANTY = 'WARRANTY',
  DASHBOARD = 'DASHBOARD',
  ADMIN = 'ADMIN',
  CRM = 'CRM',
  VHC = 'VHC',
  LISTINGS = 'LISTINGS',
  ACCOUNTING = 'ACCOUNTING',
  COURTESY_FLEET = 'COURTESY_FLEET',
  FI = 'FI',
  AI_INSIGHTS = 'AI_INSIGHTS',
  AI_CHATBOT = 'AI_CHATBOT',
  GENERAL_LEDGER = 'GENERAL_LEDGER',
  OEM_INTEGRATIONS = 'OEM_INTEGRATIONS',
}

export const MODULE_LABELS: Record<ModuleKey, string> = {
  [ModuleKey.NEW_CAR_PDI]: 'New Car Stock & PDI Pipeline',
  [ModuleKey.WORKSHOP]: 'Workshop Scheduling',
  [ModuleKey.PARTS]: 'Parts Stock Management',
  [ModuleKey.USED_CARS]: 'Used Car Sales',
  [ModuleKey.WARRANTY]: 'Warranty',
  [ModuleKey.DASHBOARD]: 'Dealer Dashboard & Reporting',
  [ModuleKey.ADMIN]: 'Admin, User Management & RBAC',
  [ModuleKey.CRM]: 'CRM & Customer Communications',
  [ModuleKey.VHC]: 'Digital Vehicle Health Check',
  [ModuleKey.LISTINGS]: 'Third-party Stock Listing Integration',
  [ModuleKey.ACCOUNTING]: 'Accounting Integration',
  [ModuleKey.COURTESY_FLEET]: 'Courtesy & Loan Car Fleet',
  [ModuleKey.FI]: 'Finance & Insurance',
  [ModuleKey.AI_INSIGHTS]: 'AI Insights & Intelligence',
  [ModuleKey.AI_CHATBOT]: 'AI Customer Chatbot',
  [ModuleKey.GENERAL_LEDGER]: 'General Ledger',
  [ModuleKey.OEM_INTEGRATIONS]: 'OEM Integration Hub',
};

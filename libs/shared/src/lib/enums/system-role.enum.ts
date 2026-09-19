import { ModuleKey } from './module-key.enum';
import { PermissionAction } from './permission-action.enum';

export enum SystemRole {
  DEALER_PRINCIPAL = 'DEALER_PRINCIPAL',
  GENERAL_MANAGER = 'GENERAL_MANAGER',
  SALES_MANAGER = 'SALES_MANAGER',
  SALES_EXECUTIVE = 'SALES_EXECUTIVE',
  WORKSHOP_CONTROLLER = 'WORKSHOP_CONTROLLER',
  SERVICE_ADVISOR = 'SERVICE_ADVISOR',
  TECHNICIAN = 'TECHNICIAN',
  PARTS_MANAGER = 'PARTS_MANAGER',
  ACCOUNTS = 'ACCOUNTS',
}

export const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  [SystemRole.DEALER_PRINCIPAL]: 'Dealer Principal',
  [SystemRole.GENERAL_MANAGER]: 'General Manager',
  [SystemRole.SALES_MANAGER]: 'Sales Manager',
  [SystemRole.SALES_EXECUTIVE]: 'Sales Executive',
  [SystemRole.WORKSHOP_CONTROLLER]: 'Workshop Controller',
  [SystemRole.SERVICE_ADVISOR]: 'Service Advisor',
  [SystemRole.TECHNICIAN]: 'Technician',
  [SystemRole.PARTS_MANAGER]: 'Parts Manager',
  [SystemRole.ACCOUNTS]: 'Accounts',
};

const ALL_MODULES = Object.values(ModuleKey);
const ALL_ACTIONS = Object.values(PermissionAction);
const FULL: PermissionAction[] = ALL_ACTIONS;
const READ_ONLY: PermissionAction[] = [PermissionAction.VIEW, PermissionAction.EXPORT];

function grant(
  modules: ModuleKey[],
  actions: PermissionAction[],
): { module: ModuleKey; action: PermissionAction }[] {
  return modules.flatMap((module) => actions.map((action) => ({ module, action })));
}

/**
 * Default permission matrix per Feature Spec §7.2 (Predefined system roles). Seeded onto each
 * dealer's Role rows at dealer setup and used to render the granular permission-matrix editor
 * when a dealer principal builds a custom role.
 */
export const SYSTEM_ROLE_PERMISSIONS: Record<
  SystemRole,
  { module: ModuleKey; action: PermissionAction }[]
> = {
  [SystemRole.DEALER_PRINCIPAL]: grant(ALL_MODULES, FULL),
  [SystemRole.GENERAL_MANAGER]: grant(
    ALL_MODULES.filter((m) => m !== ModuleKey.ADMIN),
    FULL,
  ).concat(grant([ModuleKey.ADMIN], READ_ONLY)),
  [SystemRole.SALES_MANAGER]: [
    ...grant([ModuleKey.USED_CARS, ModuleKey.DASHBOARD, ModuleKey.CRM], FULL),
    ...grant(
      ALL_MODULES.filter(
        (m) => ![ModuleKey.USED_CARS, ModuleKey.DASHBOARD, ModuleKey.CRM].includes(m),
      ),
      READ_ONLY,
    ),
  ],
  [SystemRole.SALES_EXECUTIVE]: grant([ModuleKey.CRM, ModuleKey.USED_CARS], [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
  ]),
  [SystemRole.WORKSHOP_CONTROLLER]: grant(
    [ModuleKey.NEW_CAR_PDI, ModuleKey.WORKSHOP, ModuleKey.PARTS, ModuleKey.WARRANTY],
    FULL,
  ),
  [SystemRole.SERVICE_ADVISOR]: [
    ...grant([ModuleKey.WORKSHOP], [
      PermissionAction.VIEW,
      PermissionAction.CREATE,
      PermissionAction.EDIT,
    ]),
    ...grant([ModuleKey.PARTS], READ_ONLY),
  ],
  [SystemRole.TECHNICIAN]: [
    ...grant([ModuleKey.WORKSHOP], [PermissionAction.VIEW, PermissionAction.EDIT]),
    ...grant([ModuleKey.WARRANTY], [PermissionAction.VIEW, PermissionAction.EDIT]),
    ...grant([ModuleKey.VHC], [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT]),
  ],
  [SystemRole.PARTS_MANAGER]: grant([ModuleKey.PARTS], FULL),
  [SystemRole.ACCOUNTS]: [
    ...grant([ModuleKey.ACCOUNTING, ModuleKey.GENERAL_LEDGER], FULL),
    ...grant([ModuleKey.DASHBOARD], FULL),
    ...grant(
      ALL_MODULES.filter(
        (m) => ![ModuleKey.ACCOUNTING, ModuleKey.GENERAL_LEDGER, ModuleKey.DASHBOARD].includes(m),
      ),
      READ_ONLY,
    ),
  ],
};

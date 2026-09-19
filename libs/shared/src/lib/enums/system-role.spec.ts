import { ModuleKey } from './module-key.enum';
import { PermissionAction } from './permission-action.enum';
import { SYSTEM_ROLE_PERMISSIONS, SystemRole } from './system-role.enum';

describe('SYSTEM_ROLE_PERMISSIONS', () => {
  it('defines a permission set for every system role', () => {
    for (const role of Object.values(SystemRole)) {
      expect(SYSTEM_ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });

  it('grants DEALER_PRINCIPAL every action on every module', () => {
    const grants = SYSTEM_ROLE_PERMISSIONS[SystemRole.DEALER_PRINCIPAL];
    for (const module of Object.values(ModuleKey)) {
      for (const action of Object.values(PermissionAction)) {
        expect(grants).toContainEqual({ module, action });
      }
    }
  });

  it('does not grant TECHNICIAN access to admin-only modules', () => {
    const grants = SYSTEM_ROLE_PERMISSIONS[SystemRole.TECHNICIAN];
    expect(grants.some((g) => g.module === ModuleKey.ADMIN)).toBe(false);
    expect(grants.some((g) => g.module === ModuleKey.ACCOUNTING)).toBe(false);
  });

  it('restricts PARTS_MANAGER to the Parts module only', () => {
    const grants = SYSTEM_ROLE_PERMISSIONS[SystemRole.PARTS_MANAGER];
    expect(grants.every((g) => g.module === ModuleKey.PARTS)).toBe(true);
  });
});

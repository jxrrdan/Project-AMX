import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import { RolesService } from './roles.service';

describe('RolesService.create — permission escalation guard', () => {
  const dealerId = 'dealer-1';

  it('refuses to create a role granting a permission the acting user does not hold', async () => {
    const prisma = {
      role: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    const service = new RolesService(prisma as never);

    await expect(
      service.create(
        dealerId,
        { name: 'Super Admin', permissions: [{ module: ModuleKey.ACCOUNTING, action: PermissionAction.DELETE }] } as never,
        [{ module: ModuleKey.ADMIN, action: PermissionAction.CREATE }],
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.role.create).not.toHaveBeenCalled();
  });

  it('creates the role once every requested permission is held by the acting user', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'role-1' });
    const prisma = { role: { findUnique: jest.fn().mockResolvedValue(null), create } };
    const service = new RolesService(prisma as never);

    await service.create(
      dealerId,
      { name: 'Accounts Viewer', permissions: [{ module: ModuleKey.ACCOUNTING, action: PermissionAction.VIEW }] } as never,
      [{ module: ModuleKey.ACCOUNTING, action: PermissionAction.VIEW }],
    );
    expect(create).toHaveBeenCalled();
  });

  it('still rejects a duplicate role name even when permissions are held', async () => {
    const prisma = {
      role: { findUnique: jest.fn().mockResolvedValue({ id: 'existing' }), create: jest.fn() },
    };
    const service = new RolesService(prisma as never);

    await expect(
      service.create(dealerId, { name: 'Existing', permissions: [] } as never, []),
    ).rejects.toThrow('A role with this name already exists');
  });
});

describe('RolesService.update — permission escalation guard', () => {
  const dealerId = 'dealer-1';

  it('throws when the role does not exist for this dealer', async () => {
    const prisma = { role: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new RolesService(prisma as never);
    await expect(
      service.update(dealerId, 'other-dealer-role', { name: 'X', permissions: [] } as never, []),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses to add a permission the acting user does not hold', async () => {
    const prisma = {
      role: { findFirst: jest.fn().mockResolvedValue({ id: 'role-1', dealerId }) },
      $transaction: jest.fn(),
    };
    const service = new RolesService(prisma as never);

    await expect(
      service.update(
        dealerId,
        'role-1',
        { name: 'Role', permissions: [{ module: ModuleKey.WARRANTY, action: PermissionAction.APPROVE }] } as never,
        [{ module: ModuleKey.ADMIN, action: PermissionAction.EDIT }],
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import { UsersService } from './users.service';

function makeAudit() {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'user-1', dealerId: 'dealer-1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
      update: jest.fn(),
    },
    role: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(async (fn) => fn({
      userRole: { deleteMany: jest.fn(), createMany: jest.fn() },
      userModuleOverride: { deleteMany: jest.fn(), createMany: jest.fn() },
      user: { update: jest.fn() },
      userSession: { updateMany: jest.fn() },
    })),
    ...overrides,
  };
}

describe('UsersService.update — permission escalation guard', () => {
  const dealerId = 'dealer-1';
  const userId = 'user-1';

  it('throws when the acting user tries to grant a moduleOverride permission they do not hold', async () => {
    const prisma = makePrisma();
    const service = new UsersService(prisma as never, {} as never, makeAudit() as never);

    await expect(
      service.update(
        dealerId,
        userId,
        { moduleOverrides: [{ module: ModuleKey.ACCOUNTING, action: PermissionAction.APPROVE, allowed: true }] } as never,
        'acting-user',
        [{ module: ModuleKey.ADMIN, action: PermissionAction.EDIT }],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows granting a moduleOverride permission the acting user already holds', async () => {
    const prisma = makePrisma();
    const service = new UsersService(prisma as never, {} as never, makeAudit() as never);

    await expect(
      service.update(
        dealerId,
        userId,
        { moduleOverrides: [{ module: ModuleKey.ACCOUNTING, action: PermissionAction.VIEW, allowed: true }] } as never,
        'acting-user',
        [
          { module: ModuleKey.ADMIN, action: PermissionAction.EDIT },
          { module: ModuleKey.ACCOUNTING, action: PermissionAction.VIEW },
        ],
      ),
    ).resolves.toBeDefined();
  });

  it('allows revoking a permission via moduleOverrides even if the acting user does not hold it themselves', async () => {
    const prisma = makePrisma();
    const service = new UsersService(prisma as never, {} as never, makeAudit() as never);

    await expect(
      service.update(
        dealerId,
        userId,
        { moduleOverrides: [{ module: ModuleKey.ACCOUNTING, action: PermissionAction.APPROVE, allowed: false }] } as never,
        'acting-user',
        [{ module: ModuleKey.ADMIN, action: PermissionAction.EDIT }],
      ),
    ).resolves.toBeDefined();
  });

  it('throws when assigning a role that grants a permission the acting user does not hold', async () => {
    const prisma = makePrisma({
      role: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'role-1',
            name: 'Custom Admin',
            permissions: [{ module: ModuleKey.ACCOUNTING, action: PermissionAction.DELETE }],
          },
        ]),
      },
    });
    const service = new UsersService(prisma as never, {} as never, makeAudit() as never);

    await expect(
      service.update(
        dealerId,
        userId,
        { roleIds: ['role-1'] } as never,
        'acting-user',
        [{ module: ModuleKey.ADMIN, action: PermissionAction.EDIT }],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when one of the supplied roleIds does not belong to this dealer', async () => {
    const prisma = makePrisma({ role: { findMany: jest.fn().mockResolvedValue([]) } });
    const service = new UsersService(prisma as never, {} as never, makeAudit() as never);

    await expect(
      service.update(dealerId, userId, { roleIds: ['other-dealer-role'] } as never, 'acting-user', [
        { module: ModuleKey.ADMIN, action: PermissionAction.EDIT },
      ]),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows assigning a role whose every permission the acting user already holds', async () => {
    const prisma = makePrisma({
      role: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'role-1', name: 'Viewer', permissions: [{ module: ModuleKey.ACCOUNTING, action: PermissionAction.VIEW }] },
        ]),
      },
    });
    const service = new UsersService(prisma as never, {} as never, makeAudit() as never);

    await expect(
      service.update(dealerId, userId, { roleIds: ['role-1'] } as never, 'acting-user', [
        { module: ModuleKey.ADMIN, action: PermissionAction.EDIT },
        { module: ModuleKey.ACCOUNTING, action: PermissionAction.VIEW },
      ]),
    ).resolves.toBeDefined();
  });

  it('throws when the target user does not belong to this dealer', async () => {
    const prisma = makePrisma({ user: { findFirst: jest.fn().mockResolvedValue(null) } });
    const service = new UsersService(prisma as never, {} as never, makeAudit() as never);

    await expect(
      service.update(dealerId, 'other-dealer-user', { active: false } as never, 'acting-user', []),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('UsersService.updateMyProfile', () => {
  it('only ever updates the calling user\'s own id, never a client-supplied one', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'user-1', phone: '+447700900000' });
    const prisma = { user: { update } };
    const service = new UsersService(prisma as never, {} as never, makeAudit() as never);

    await service.updateMyProfile('user-1', { phone: '+447700900000' });

    expect(update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { phone: '+447700900000' } });
  });

  it('clears the phone number when given null', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'user-1', phone: null });
    const prisma = { user: { update } };
    const service = new UsersService(prisma as never, {} as never, makeAudit() as never);

    await service.updateMyProfile('user-1', { phone: null });

    expect(update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { phone: null } });
  });
});

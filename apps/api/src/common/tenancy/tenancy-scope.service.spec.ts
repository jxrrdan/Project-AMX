import { ConfigScope } from '@project-amx/shared';
import { TenancyScopeService } from './tenancy-scope.service';

describe('TenancyScopeService.resolve', () => {
  it('returns nulls when the dealer has no franchise', async () => {
    const prisma = { dealer: { findUnique: jest.fn().mockResolvedValue({ franchiseId: null, franchise: null }) } };
    const service = new TenancyScopeService(prisma as never);

    const ctx = await service.resolve('dealer-1');

    expect(ctx).toEqual({ dealerId: 'dealer-1', franchiseId: null, groupId: null });
  });

  it('returns the franchise and its group when both are set', async () => {
    const prisma = {
      dealer: { findUnique: jest.fn().mockResolvedValue({ franchiseId: 'f1', franchise: { groupId: 'g1' } }) },
    };
    const service = new TenancyScopeService(prisma as never);

    const ctx = await service.resolve('dealer-1');

    expect(ctx).toEqual({ dealerId: 'dealer-1', franchiseId: 'f1', groupId: 'g1' });
  });

  it('returns a franchise with no group as null groupId', async () => {
    const prisma = {
      dealer: { findUnique: jest.fn().mockResolvedValue({ franchiseId: 'f1', franchise: { groupId: null } }) },
    };
    const service = new TenancyScopeService(prisma as never);

    const ctx = await service.resolve('dealer-1');

    expect(ctx.groupId).toBeNull();
  });
});

describe('TenancyScopeService.scopeWhereClauses', () => {
  it('is DEALER-only when there is no franchise', () => {
    const service = new TenancyScopeService({} as never);
    const clauses = service.scopeWhereClauses({ dealerId: 'd1', franchiseId: null, groupId: null });
    expect(clauses).toEqual([{ scope: ConfigScope.DEALER, dealerId: 'd1' }]);
  });

  it('is ordered DEALER, FRANCHISE, GROUP (most specific first) when both are set', () => {
    const service = new TenancyScopeService({} as never);
    const clauses = service.scopeWhereClauses({ dealerId: 'd1', franchiseId: 'f1', groupId: 'g1' });
    expect(clauses).toEqual([
      { scope: ConfigScope.DEALER, dealerId: 'd1' },
      { scope: ConfigScope.FRANCHISE, franchiseId: 'f1' },
      { scope: ConfigScope.GROUP, groupId: 'g1' },
    ]);
  });
});

describe('TenancyScopeService.canAccess', () => {
  it('a DEALER-scoped row is only accessible to its own dealer', async () => {
    const service = new TenancyScopeService({} as never);
    await expect(
      service.canAccess('dealer-1', { scope: ConfigScope.DEALER, dealerId: 'dealer-1', franchiseId: null, groupId: null }),
    ).resolves.toBe(true);
    await expect(
      service.canAccess('dealer-1', { scope: ConfigScope.DEALER, dealerId: 'dealer-2', franchiseId: null, groupId: null }),
    ).resolves.toBe(false);
  });

  it('a FRANCHISE-scoped row is accessible to any dealer in that franchise, not another one', async () => {
    const prisma = { dealer: { findUnique: jest.fn().mockResolvedValue({ franchiseId: 'f1', franchise: { groupId: null } }) } };
    const service = new TenancyScopeService(prisma as never);

    await expect(
      service.canAccess('dealer-1', { scope: ConfigScope.FRANCHISE, dealerId: null, franchiseId: 'f1', groupId: null }),
    ).resolves.toBe(true);
    await expect(
      service.canAccess('dealer-1', { scope: ConfigScope.FRANCHISE, dealerId: null, franchiseId: 'other-franchise', groupId: null }),
    ).resolves.toBe(false);
  });

  it('a GROUP-scoped row is accessible to any dealer whose franchise belongs to that group', async () => {
    const prisma = { dealer: { findUnique: jest.fn().mockResolvedValue({ franchiseId: 'f1', franchise: { groupId: 'g1' } }) } };
    const service = new TenancyScopeService(prisma as never);

    await expect(
      service.canAccess('dealer-1', { scope: ConfigScope.GROUP, dealerId: null, franchiseId: null, groupId: 'g1' }),
    ).resolves.toBe(true);
    await expect(
      service.canAccess('dealer-1', { scope: ConfigScope.GROUP, dealerId: null, franchiseId: null, groupId: 'other-group' }),
    ).resolves.toBe(false);
  });
});

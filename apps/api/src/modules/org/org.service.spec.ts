import { BadRequestException } from '@nestjs/common';
import { OrgService } from './org.service';

describe('OrgService.myOrg', () => {
  it("returns only the caller's own franchise/group, never a directory of every org", async () => {
    const prisma = {
      dealer: {
        findUnique: jest.fn().mockResolvedValue({
          franchise: { id: 'f1', name: 'BMW', brandCode: 'BMW', joinCode: 'franchise-code', group: { id: 'g1', name: 'Sytner', joinCode: 'group-code' } },
        }),
      },
    };
    const service = new OrgService(prisma as never);

    const result = await service.myOrg('dealer-1');

    expect(result).toEqual({
      franchise: { id: 'f1', name: 'BMW', brandCode: 'BMW', joinCode: 'franchise-code' },
      group: { id: 'g1', name: 'Sytner', joinCode: 'group-code' },
    });
  });

  it('returns nulls when the dealer has no franchise yet', async () => {
    const prisma = { dealer: { findUnique: jest.fn().mockResolvedValue({ franchise: null }) } };
    const service = new OrgService(prisma as never);

    const result = await service.myOrg('dealer-1');

    expect(result).toEqual({ franchise: null, group: null });
  });
});

describe('OrgService.createFranchise', () => {
  it('rejects an invalid group join code', async () => {
    const prisma = { group: { findUnique: jest.fn().mockResolvedValue(null) }, franchise: { create: jest.fn() } };
    const service = new OrgService(prisma as never);
    await expect(service.createFranchise({ name: 'BMW', groupJoinCode: 'guessed-or-stolen-code' })).rejects.toThrow(BadRequestException);
    expect(prisma.franchise.create).not.toHaveBeenCalled();
  });

  it('creates a franchise with no group when groupJoinCode is omitted', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'f1', name: 'BMW' });
    const prisma = { franchise: { create } };
    const service = new OrgService(prisma as never);
    await service.createFranchise({ name: 'BMW' });
    expect(create).toHaveBeenCalledWith({ data: { name: 'BMW', brandCode: undefined, groupId: undefined } });
  });

  it('resolves the group by its join code, never by a client-supplied raw id', async () => {
    const prisma = {
      group: { findUnique: jest.fn().mockResolvedValue({ id: 'g1' }) },
      franchise: { create: jest.fn().mockResolvedValue({ id: 'f1' }) },
    };
    const service = new OrgService(prisma as never);
    await service.createFranchise({ name: 'BMW', groupJoinCode: 'real-code' });
    expect(prisma.group.findUnique).toHaveBeenCalledWith({ where: { joinCode: 'real-code' } });
    expect(prisma.franchise.create).toHaveBeenCalledWith({ data: { name: 'BMW', brandCode: undefined, groupId: 'g1' } });
  });
});

describe('OrgService.assignDealerFranchise', () => {
  it('rejects an invalid franchise join code', async () => {
    const prisma = { franchise: { findUnique: jest.fn().mockResolvedValue(null) }, dealer: { update: jest.fn() } };
    const service = new OrgService(prisma as never);
    await expect(service.assignDealerFranchise('dealer-1', { franchiseJoinCode: 'guessed-or-stolen-code' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.dealer.update).not.toHaveBeenCalled();
  });

  it('clears the franchise when no join code is given', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'dealer-1', franchiseId: null });
    const prisma = { dealer: { update } };
    const service = new OrgService(prisma as never);
    await service.assignDealerFranchise('dealer-1', {});
    expect(update).toHaveBeenCalledWith({ where: { id: 'dealer-1' }, data: { franchiseId: null } });
  });

  it('resolves the franchise by its join code, never by a client-supplied raw id — closing the cross-tenant escalation where any ADMIN:EDIT user could attach to any franchise by guessing its id', async () => {
    const prisma = {
      franchise: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      dealer: { update: jest.fn().mockResolvedValue({ id: 'dealer-1', franchiseId: 'f1' }) },
    };
    const service = new OrgService(prisma as never);
    await service.assignDealerFranchise('dealer-1', { franchiseJoinCode: 'real-code' });
    expect(prisma.franchise.findUnique).toHaveBeenCalledWith({ where: { joinCode: 'real-code' } });
    expect(prisma.dealer.update).toHaveBeenCalledWith({ where: { id: 'dealer-1' }, data: { franchiseId: 'f1' } });
  });
});

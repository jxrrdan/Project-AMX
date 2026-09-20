import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrgService } from './org.service';

describe('OrgService.createFranchise', () => {
  it('rejects an unknown groupId', async () => {
    const prisma = { group: { findUnique: jest.fn().mockResolvedValue(null) }, franchise: { create: jest.fn() } };
    const service = new OrgService(prisma as never);
    await expect(service.createFranchise({ name: 'BMW', groupId: 'missing-group' })).rejects.toThrow(BadRequestException);
    expect(prisma.franchise.create).not.toHaveBeenCalled();
  });

  it('creates a franchise with no group when groupId is omitted', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'f1', name: 'BMW' });
    const prisma = { franchise: { create } };
    const service = new OrgService(prisma as never);
    await service.createFranchise({ name: 'BMW' });
    expect(create).toHaveBeenCalledWith({ data: { name: 'BMW', brandCode: undefined, groupId: undefined } });
  });
});

describe('OrgService.assignDealerFranchise', () => {
  it('rejects an unknown franchiseId', async () => {
    const prisma = { franchise: { findUnique: jest.fn().mockResolvedValue(null) }, dealer: { update: jest.fn() } };
    const service = new OrgService(prisma as never);
    await expect(service.assignDealerFranchise('dealer-1', { franchiseId: 'missing' })).rejects.toThrow(NotFoundException);
    expect(prisma.dealer.update).not.toHaveBeenCalled();
  });

  it('clears the franchise when franchiseId is null', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'dealer-1', franchiseId: null });
    const prisma = { dealer: { update } };
    const service = new OrgService(prisma as never);
    await service.assignDealerFranchise('dealer-1', { franchiseId: null });
    expect(update).toHaveBeenCalledWith({ where: { id: 'dealer-1' }, data: { franchiseId: null } });
  });

  it('assigns a dealer to a valid franchise', async () => {
    const prisma = {
      franchise: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      dealer: { update: jest.fn().mockResolvedValue({ id: 'dealer-1', franchiseId: 'f1' }) },
    };
    const service = new OrgService(prisma as never);
    await service.assignDealerFranchise('dealer-1', { franchiseId: 'f1' });
    expect(prisma.dealer.update).toHaveBeenCalledWith({ where: { id: 'dealer-1' }, data: { franchiseId: 'f1' } });
  });
});

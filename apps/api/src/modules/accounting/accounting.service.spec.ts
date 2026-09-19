import { NotFoundException } from '@nestjs/common';
import { AccountingService } from './accounting.service';

describe('AccountingService.updateMapping', () => {
  const dealerId = 'dealer-1';

  it('refuses to update a mapping on another dealer\'s integration', async () => {
    const update = jest.fn();
    const prisma = { accountingIntegration: { findFirst: jest.fn().mockResolvedValue(null), update } };
    const service = new AccountingService(prisma as never);
    await expect(service.updateMapping(dealerId, 'other-dealer-integration', {})).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('updates the mapping once ownership is confirmed', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'integration-1' });
    const prisma = {
      accountingIntegration: { findFirst: jest.fn().mockResolvedValue({ id: 'integration-1' }), update },
    };
    const service = new AccountingService(prisma as never);
    await service.updateMapping(dealerId, 'integration-1', { REVENUE: '4000' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'integration-1' }, data: { accountMappings: { REVENUE: '4000' } } }),
    );
  });
});

describe('AccountingService.createTransaction', () => {
  const dealerId = 'dealer-1';

  it('refuses to attach a transaction to another dealer\'s integration', async () => {
    const create = jest.fn();
    const prisma = {
      accountingIntegration: { findFirst: jest.fn().mockResolvedValue(null) },
      accountingTransaction: { create },
    };
    const service = new AccountingService(prisma as never);
    await expect(
      service.createTransaction(dealerId, { integrationId: 'other-dealer-integration', type: 'INVOICE', amount: 100 } as never),
    ).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates the transaction once the integration is confirmed to belong to this dealer', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'txn-1' });
    const prisma = {
      accountingIntegration: { findFirst: jest.fn().mockResolvedValue({ id: 'integration-1' }) },
      accountingTransaction: { create },
    };
    const service = new AccountingService(prisma as never);
    await service.createTransaction(dealerId, { integrationId: 'integration-1', type: 'INVOICE', amount: 100 } as never);
    expect(create).toHaveBeenCalled();
  });
});

describe('AccountingService.sync', () => {
  const dealerId = 'dealer-1';

  it('refuses to sync a transaction belonging to another dealer', async () => {
    const update = jest.fn();
    const prisma = {
      accountingTransaction: { findFirst: jest.fn().mockResolvedValue(null), update },
    };
    const service = new AccountingService(prisma as never);
    await expect(service.sync(dealerId, 'other-dealer-transaction')).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('marks the transaction SYNCED once ownership is confirmed', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'txn-1', status: 'SYNCED' });
    const prisma = {
      accountingTransaction: {
        findFirst: jest.fn().mockResolvedValue({ id: 'txn-1', type: 'INVOICE', amount: 100 }),
        update,
      },
    };
    const service = new AccountingService(prisma as never);
    await service.sync(dealerId, 'txn-1');
    expect(update).toHaveBeenCalled();
  });
});

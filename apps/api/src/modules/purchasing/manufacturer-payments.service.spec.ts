import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ManufacturerPaymentBatchStatus, WarrantyClaimStatus } from '@prisma/client';
import { ManufacturerPaymentsService } from './manufacturer-payments.service';

function makeBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'batch-1',
    dealerId: 'dealer-1',
    supplierId: 'supplier-1',
    supplier: { id: 'supplier-1', name: 'BMW (UK) Ltd' },
    batchReference: 'AWP-2026-01',
    totalAmount: 500,
    status: ManufacturerPaymentBatchStatus.RECEIVED,
    lines: [
      { id: 'line-1', warrantyClaimId: 'claim-1', amount: 300, warrantyClaim: { id: 'claim-1', expectedPayment: 300 } },
      { id: 'line-2', warrantyClaimId: 'claim-2', amount: 200, warrantyClaim: { id: 'claim-2', expectedPayment: 150 } },
    ],
    ...overrides,
  };
}

describe('ManufacturerPaymentsService.createBatch', () => {
  it('refuses a supplier outside the caller\'s dealer', async () => {
    const prisma = { supplier: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new ManufacturerPaymentsService(prisma as never, {} as never);
    await expect(
      service.createBatch('dealer-1', { supplierId: 'other', batchReference: 'REF', lines: [] } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses a warranty claim that does not belong to this dealer', async () => {
    const prisma = {
      supplier: { findFirst: jest.fn().mockResolvedValue({ id: 'supplier-1' }) },
      warrantyClaim: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new ManufacturerPaymentsService(prisma as never, {} as never);
    await expect(
      service.createBatch('dealer-1', {
        supplierId: 'supplier-1',
        batchReference: 'REF',
        lines: [{ warrantyClaimId: 'claim-x', description: 'x', amount: 100 }],
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('sums line amounts into totalAmount', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'batch-1' });
    const prisma = {
      supplier: { findFirst: jest.fn().mockResolvedValue({ id: 'supplier-1' }) },
      warrantyClaim: { findMany: jest.fn().mockResolvedValue([{ id: 'claim-1' }]) },
      manufacturerPaymentBatch: { create },
    };
    const service = new ManufacturerPaymentsService(prisma as never, {} as never);
    await service.createBatch('dealer-1', {
      supplierId: 'supplier-1',
      batchReference: 'REF',
      lines: [{ warrantyClaimId: 'claim-1', description: 'a', amount: 100 }, { description: 'b', amount: 50 }],
    } as never);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ totalAmount: 150 }) }));
  });
});

describe('ManufacturerPaymentsService.reconcileBatch', () => {
  it('flags DISCREPANCY when any line differs from its claim\'s expected payment', async () => {
    const batch = makeBatch();
    const update = jest.fn().mockResolvedValue({ status: ManufacturerPaymentBatchStatus.DISCREPANCY });
    const prisma = {
      manufacturerPaymentBatch: { findFirst: jest.fn().mockResolvedValue(batch), update },
      manufacturerPaymentBatchLine: { update: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const service = new ManufacturerPaymentsService(prisma as never, {} as never);
    await service.reconcileBatch('dealer-1', 'batch-1');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: ManufacturerPaymentBatchStatus.DISCREPANCY }) }));
  });

  it('marks RECONCILED when every matched line agrees with its claim', async () => {
    const batch = makeBatch({
      lines: [{ id: 'line-1', warrantyClaimId: 'claim-1', amount: 300, warrantyClaim: { id: 'claim-1', expectedPayment: 300 } }],
    });
    const update = jest.fn().mockResolvedValue({ status: ManufacturerPaymentBatchStatus.RECONCILED });
    const prisma = {
      manufacturerPaymentBatch: { findFirst: jest.fn().mockResolvedValue(batch), update },
      manufacturerPaymentBatchLine: { update: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const service = new ManufacturerPaymentsService(prisma as never, {} as never);
    await service.reconcileBatch('dealer-1', 'batch-1');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: ManufacturerPaymentBatchStatus.RECONCILED }) }));
  });
});

describe('ManufacturerPaymentsService.postBatch', () => {
  it('refuses to post a batch that has not been reconciled', async () => {
    const batch = makeBatch({ status: ManufacturerPaymentBatchStatus.RECEIVED });
    const prisma = { manufacturerPaymentBatch: { findFirst: jest.fn().mockResolvedValue(batch) } };
    const service = new ManufacturerPaymentsService(prisma as never, { post: jest.fn() } as never);
    await expect(service.postBatch('dealer-1', 'batch-1')).rejects.toThrow(BadRequestException);
  });

  it('refuses to double-post an already-posted batch', async () => {
    const batch = makeBatch({ status: ManufacturerPaymentBatchStatus.POSTED });
    const prisma = { manufacturerPaymentBatch: { findFirst: jest.fn().mockResolvedValue(batch) } };
    const service = new ManufacturerPaymentsService(prisma as never, { post: jest.fn() } as never);
    await expect(service.postBatch('dealer-1', 'batch-1')).rejects.toThrow(BadRequestException);
  });

  it('posts one consolidated journal and settles every linked claim to PAID', async () => {
    const batch = makeBatch({ status: ManufacturerPaymentBatchStatus.RECONCILED });
    const updateBatch = jest.fn().mockResolvedValue({ status: ManufacturerPaymentBatchStatus.POSTED });
    const updateClaim = jest.fn();
    const post = jest.fn().mockResolvedValue({ id: 'je-1' });
    const prisma = {
      manufacturerPaymentBatch: { findFirst: jest.fn().mockResolvedValue(batch), update: updateBatch },
      warrantyClaim: { update: updateClaim },
    };
    const service = new ManufacturerPaymentsService(prisma as never, { post } as never);

    await service.postBatch('dealer-1', 'batch-1');

    expect(post).toHaveBeenCalledWith(
      'dealer-1',
      expect.objectContaining({
        lines: expect.arrayContaining([expect.objectContaining({ debit: 500 }), expect.objectContaining({ credit: 500 })]),
      }),
    );
    expect(updateClaim).toHaveBeenCalledWith({ where: { id: 'claim-1' }, data: { status: WarrantyClaimStatus.PAID, actualPayment: 300 } });
    expect(updateClaim).toHaveBeenCalledWith({ where: { id: 'claim-2' }, data: { status: WarrantyClaimStatus.PAID, actualPayment: 200 } });
    expect(updateBatch).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: ManufacturerPaymentBatchStatus.POSTED }) }));
  });
});

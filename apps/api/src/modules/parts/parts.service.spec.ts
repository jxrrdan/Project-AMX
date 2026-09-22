import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PurchaseOrderStatus, StockMovementType } from '@project-amx/shared';
import { PartsService } from './parts.service';

function makePart(overrides: Record<string, unknown> = {}) {
  return { id: 'part-1', dealerId: 'dealer-1', quantityOnHand: 10, reorderLevel: 5, ...overrides };
}

describe('PartsService.recordMovement', () => {
  it('throws when the part does not belong to this dealer', async () => {
    const prisma = { part: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new PartsService(prisma as never);
    await expect(
      service.recordMovement('dealer-1', { partId: 'missing', type: StockMovementType.GOODS_RECEIVED, quantity: 5 } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('increases stock for a goods-received movement', async () => {
    const update = jest.fn();
    const prisma = {
      part: { findFirst: jest.fn().mockResolvedValue(makePart()), update },
      stockMovement: { create: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const service = new PartsService(prisma as never);
    await service.recordMovement('dealer-1', { partId: 'part-1', type: StockMovementType.GOODS_RECEIVED, quantity: 5 } as never);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quantityOnHand: { increment: 5 } } }),
    );
  });

  it('decreases stock for an allocated movement', async () => {
    const update = jest.fn();
    const prisma = {
      part: { findFirst: jest.fn().mockResolvedValue(makePart()), update },
      stockMovement: { create: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const service = new PartsService(prisma as never);
    await service.recordMovement('dealer-1', { partId: 'part-1', type: StockMovementType.ALLOCATED, quantity: 4 } as never);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quantityOnHand: { increment: -4 } } }),
    );
  });

  it('rejects a movement that would take stock below zero', async () => {
    const prisma = {
      part: { findFirst: jest.fn().mockResolvedValue(makePart({ quantityOnHand: 3 })) },
    };
    const service = new PartsService(prisma as never);
    await expect(
      service.recordMovement('dealer-1', { partId: 'part-1', type: StockMovementType.WRITE_OFF, quantity: 5 } as never),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('PartsService.allocateToJob', () => {
  it('throws when the part does not belong to this dealer', async () => {
    const prisma = { part: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new PartsService(prisma as never);
    await expect(
      service.allocateToJob('dealer-1', { partId: 'missing', quantity: 1, jobCardId: 'job-1' } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses to allocate to a job card belonging to another dealer', async () => {
    const createAllocation = jest.fn();
    const prisma = {
      part: { findFirst: jest.fn().mockResolvedValue(makePart({ quantityOnHand: 10 })) },
      jobCard: { findFirst: jest.fn().mockResolvedValue(null) },
      partAllocation: { create: createAllocation },
    };
    const service = new PartsService(prisma as never);
    await expect(
      service.allocateToJob('dealer-1', { partId: 'part-1', quantity: 3, jobCardId: 'other-dealer-job' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(createAllocation).not.toHaveBeenCalled();
  });

  it('rejects allocating more than is on hand', async () => {
    const prisma = {
      part: { findFirst: jest.fn().mockResolvedValue(makePart({ quantityOnHand: 2 })) },
      jobCard: { findFirst: jest.fn().mockResolvedValue({ id: 'job-1' }) },
    };
    const service = new PartsService(prisma as never);
    await expect(
      service.allocateToJob('dealer-1', { partId: 'part-1', quantity: 5, jobCardId: 'job-1' } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('decrements stock and records an allocation movement when there is enough stock', async () => {
    const updatePart = jest.fn();
    const createAllocation = jest.fn();
    const createMovement = jest.fn();
    const prisma = {
      part: { findFirst: jest.fn().mockResolvedValue(makePart({ quantityOnHand: 10 })), update: updatePart },
      jobCard: { findFirst: jest.fn().mockResolvedValue({ id: 'job-1' }) },
      partAllocation: { create: createAllocation },
      stockMovement: { create: createMovement },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const service = new PartsService(prisma as never);
    await service.allocateToJob('dealer-1', { partId: 'part-1', quantity: 3, jobCardId: 'job-1' } as never);
    expect(updatePart).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quantityOnHand: { decrement: 3 } } }),
    );
    expect(createAllocation).toHaveBeenCalled();
    expect(createMovement).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: StockMovementType.ALLOCATED, quantity: 3 }) }),
    );
  });
});

describe('PartsService.generateSuggestedPurchaseOrder', () => {
  it('refuses a supplier outside the caller\'s dealer', async () => {
    const create = jest.fn();
    const prisma = { supplier: { findFirst: jest.fn().mockResolvedValue(null) }, purchaseOrder: { create } };
    const service = new PartsService(prisma as never);
    await expect(
      service.generateSuggestedPurchaseOrder('dealer-1', { supplierId: 'other-dealer-supplier' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('generates a PO line for every part at or below its reorder level', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = {
      supplier: { findFirst: jest.fn().mockResolvedValue({ id: 'supplier-1' }) },
      part: { findMany: jest.fn().mockResolvedValue([makePart({ quantityOnHand: 2, reorderLevel: 5, costPrice: 10 })]) },
      purchaseOrder: { create },
    };
    const service = new PartsService(prisma as never);
    await service.generateSuggestedPurchaseOrder('dealer-1', { supplierId: 'supplier-1' } as never);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dealerId: 'dealer-1', supplierId: 'supplier-1' }) }),
    );
  });
});

describe('PartsService.receivePurchaseOrderLine', () => {
  it('throws when the purchase order line does not exist for this dealer', async () => {
    const prisma = { purchaseOrderLine: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new PartsService(prisma as never);
    await expect(service.receivePurchaseOrderLine('dealer-1', 'missing', 5)).rejects.toThrow(NotFoundException);
  });

  it('marks the order PARTIALLY_RECEIVED when some lines are still short', async () => {
    const updateOrder = jest.fn();
    const prisma = {
      purchaseOrderLine: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'line-1',
          partId: 'part-1',
          purchaseOrderId: 'po-1',
          quantityReceived: 0,
          quantityOrdered: 10,
          purchaseOrder: { lines: [] },
        }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'line-1', quantityReceived: 0, quantityOrdered: 10 },
          { id: 'line-2', quantityReceived: 0, quantityOrdered: 5 },
        ]),
        update: jest.fn(),
      },
      part: { update: jest.fn() },
      stockMovement: { create: jest.fn() },
      purchaseOrder: { update: updateOrder },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const service = new PartsService(prisma as never);
    await service.receivePurchaseOrderLine('dealer-1', 'line-1', 4);
    expect(updateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: PurchaseOrderStatus.PARTIALLY_RECEIVED } }),
    );
  });

  it('marks the order FULLY_RECEIVED once every line has reached its ordered quantity', async () => {
    const updateOrder = jest.fn();
    const prisma = {
      purchaseOrderLine: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'line-1',
          partId: 'part-1',
          purchaseOrderId: 'po-1',
          quantityReceived: 6,
          quantityOrdered: 10,
          purchaseOrder: { lines: [] },
        }),
        findMany: jest.fn().mockResolvedValue([{ id: 'line-1', quantityReceived: 6, quantityOrdered: 10 }]),
        update: jest.fn(),
      },
      part: { update: jest.fn() },
      stockMovement: { create: jest.fn() },
      purchaseOrder: { update: updateOrder },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const service = new PartsService(prisma as never);
    await service.receivePurchaseOrderLine('dealer-1', 'line-1', 4);
    expect(updateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: PurchaseOrderStatus.FULLY_RECEIVED } }),
    );
  });
});

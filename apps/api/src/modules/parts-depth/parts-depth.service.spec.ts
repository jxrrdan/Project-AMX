import { BadRequestException } from '@nestjs/common';
import { BackorderStatus, StockCountStatus } from '@project-amx/shared';
import { PartsDepthService } from './parts-depth.service';

const dealerId = 'dealer-1';

describe('PartsDepthService.completeStockCount', () => {
  it('posts a variance movement and sets on-hand to the counted qty, skipping matches and uncounted lines', async () => {
    const tx = {
      stockMovement: { create: jest.fn().mockResolvedValue({}) },
      part: { update: jest.fn().mockResolvedValue({}) },
      stockCount: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      stockCount: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sc-1',
          dealerId,
          reference: 'Q3',
          status: StockCountStatus.OPEN,
          lines: [
            { partId: 'p1', countedQty: 8, part: { quantityOnHand: 10 } }, // variance -2
            { partId: 'p2', countedQty: 10, part: { quantityOnHand: 10 } }, // no variance
            { partId: 'p3', countedQty: null, part: { quantityOnHand: 5 } }, // uncounted
          ],
        }),
      },
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
    };
    const service = new PartsDepthService(prisma as never);
    const result = await service.completeStockCount(dealerId, 'sc-1');
    expect(result.adjustments).toBe(1);
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
    const mv = tx.stockMovement.create.mock.calls[0][0].data;
    expect(mv.type).toBe('WRITE_OFF');
    expect(mv.quantity).toBe(2);
    expect(tx.part.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { quantityOnHand: 8 } });
  });

  it('refuses to complete an already-completed count', async () => {
    const prisma = {
      stockCount: { findFirst: jest.fn().mockResolvedValue({ id: 'sc-1', dealerId, status: StockCountStatus.COMPLETED, lines: [] }) },
    };
    const service = new PartsDepthService(prisma as never);
    await expect(service.completeStockCount(dealerId, 'sc-1')).rejects.toThrow(BadRequestException);
  });
});

describe('PartsDepthService.updateBackorder', () => {
  it('books stock in when a backorder is marked received', async () => {
    const tx = {
      stockMovement: { create: jest.fn().mockResolvedValue({}) },
      part: { update: jest.fn().mockResolvedValue({}) },
      partBackorder: { update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'bo-1', ...data })) },
    };
    const prisma = {
      partBackorder: { findFirst: jest.fn().mockResolvedValue({ id: 'bo-1', dealerId, partId: 'p1', quantity: 4, status: BackorderStatus.OUTSTANDING, reference: 'PO1' }) },
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
    };
    const service = new PartsDepthService(prisma as never);
    await service.updateBackorder(dealerId, 'bo-1', { status: BackorderStatus.RECEIVED });
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create.mock.calls[0][0].data.type).toBe('GOODS_RECEIVED');
    expect(tx.part.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { quantityOnHand: { increment: 4 } } });
  });

  it('does not book stock when only the expected date changes', async () => {
    const tx = {
      stockMovement: { create: jest.fn() },
      part: { update: jest.fn() },
      partBackorder: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      partBackorder: { findFirst: jest.fn().mockResolvedValue({ id: 'bo-1', dealerId, partId: 'p1', quantity: 4, status: BackorderStatus.OUTSTANDING }) },
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
    };
    const service = new PartsDepthService(prisma as never);
    await service.updateBackorder(dealerId, 'bo-1', { expectedDate: '2026-10-01' });
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
});

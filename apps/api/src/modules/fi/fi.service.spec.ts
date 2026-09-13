import { NotFoundException } from '@nestjs/common';
import { FiService } from './fi.service';

describe('FiService.addToDeal', () => {
  it('throws when the finance product does not exist', async () => {
    const prisma = { financeProduct: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new FiService(prisma as never);
    await expect(service.addToDeal({ productId: 'missing', totalPremium: 500 } as never)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('calculates commission as a percentage of the premium when the product has a commission rate', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const prisma = {
      financeProduct: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', commissionRate: 10, commissionFixed: null }) },
      dealFinanceProduct: { create },
    };
    const service = new FiService(prisma as never);
    const result = await service.addToDeal({ productId: 'p1', totalPremium: 500 } as never);
    expect(result.commissionAmount).toBe(50);
  });

  it('uses amountFinanced as the base when totalPremium is absent', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const prisma = {
      financeProduct: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', commissionRate: 5, commissionFixed: null }) },
      dealFinanceProduct: { create },
    };
    const service = new FiService(prisma as never);
    const result = await service.addToDeal({ productId: 'p1', amountFinanced: 20000 } as never);
    expect(result.commissionAmount).toBe(1000);
  });

  it('prefers a fixed commission over a percentage rate when both are set', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const prisma = {
      financeProduct: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', commissionRate: 10, commissionFixed: 75 }) },
      dealFinanceProduct: { create },
    };
    const service = new FiService(prisma as never);
    const result = await service.addToDeal({ productId: 'p1', totalPremium: 500 } as never);
    expect(result.commissionAmount).toBe(75);
  });

  it('defaults commission to zero when the product has neither a fixed amount nor a rate', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const prisma = {
      financeProduct: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', commissionRate: null, commissionFixed: null }) },
      dealFinanceProduct: { create },
    };
    const service = new FiService(prisma as never);
    const result = await service.addToDeal({ productId: 'p1', totalPremium: 500 } as never);
    expect(result.commissionAmount).toBe(0);
  });
});

describe('FiService.commissionReport', () => {
  it('sums commission and splits deals by product type', async () => {
    const prisma = {
      dealFinanceProduct: {
        findMany: jest.fn().mockResolvedValue([
          { commissionAmount: 100, product: { type: 'FINANCE' } },
          { commissionAmount: 50, product: { type: 'INSURANCE' } },
          { commissionAmount: null, product: { type: 'INSURANCE' } },
        ]),
      },
    };
    const service = new FiService(prisma as never);
    const report = await service.commissionReport('dealer-1');
    expect(report).toEqual({ totalCommission: 150, dealCount: 3, financePenetration: 1, insuranceAttachment: 2 });
  });
});

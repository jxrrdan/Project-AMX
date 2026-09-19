import { NotFoundException } from '@nestjs/common';
import { FiService } from './fi.service';

describe('FiService.addToDeal', () => {
  it('throws when the finance product does not exist for this dealer', async () => {
    const prisma = { financeProduct: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new FiService(prisma as never);
    await expect(
      service.addToDeal('dealer-1', { productId: 'missing', totalPremium: 500 } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses to link a finance product belonging to another dealer', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { financeProduct: { findFirst } };
    const service = new FiService(prisma as never);
    await expect(
      service.addToDeal('dealer-1', { productId: 'dealer-2-product', totalPremium: 500 } as never),
    ).rejects.toThrow(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'dealer-2-product', dealerId: 'dealer-1' } }),
    );
  });

  it('calculates commission as a percentage of the premium when the product has a commission rate', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const prisma = {
      financeProduct: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', commissionRate: 10, commissionFixed: null }) },
      dealFinanceProduct: { create },
    };
    const service = new FiService(prisma as never);
    const result = await service.addToDeal('dealer-1', { productId: 'p1', totalPremium: 500 } as never);
    expect(result.commissionAmount).toBe(50);
  });

  it('uses amountFinanced as the base when totalPremium is absent', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const prisma = {
      financeProduct: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', commissionRate: 5, commissionFixed: null }) },
      dealFinanceProduct: { create },
    };
    const service = new FiService(prisma as never);
    const result = await service.addToDeal('dealer-1', { productId: 'p1', amountFinanced: 20000 } as never);
    expect(result.commissionAmount).toBe(1000);
  });

  it('prefers a fixed commission over a percentage rate when both are set', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const prisma = {
      financeProduct: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', commissionRate: 10, commissionFixed: 75 }) },
      dealFinanceProduct: { create },
    };
    const service = new FiService(prisma as never);
    const result = await service.addToDeal('dealer-1', { productId: 'p1', totalPremium: 500 } as never);
    expect(result.commissionAmount).toBe(75);
  });

  it('defaults commission to zero when the product has neither a fixed amount nor a rate', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const prisma = {
      financeProduct: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', commissionRate: null, commissionFixed: null }) },
      dealFinanceProduct: { create },
    };
    const service = new FiService(prisma as never);
    const result = await service.addToDeal('dealer-1', { productId: 'p1', totalPremium: 500 } as never);
    expect(result.commissionAmount).toBe(0);
  });

  it('refuses to link a used vehicle belonging to another dealer', async () => {
    const create = jest.fn();
    const prisma = {
      financeProduct: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', commissionRate: 10, commissionFixed: null }) },
      usedVehicle: { findFirst: jest.fn().mockResolvedValue(null) },
      dealFinanceProduct: { create },
    };
    const service = new FiService(prisma as never);
    await expect(
      service.addToDeal('dealer-1', { productId: 'p1', usedVehicleId: 'dealer-2-vehicle', totalPremium: 500 } as never),
    ).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('FiService.recordDisclosure', () => {
  it('refuses to record a disclosure on another dealer\'s deal-finance-product', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn();
    const prisma = { dealFinanceProduct: { findFirst }, fcaDisclosure: { create } };
    const service = new FiService(prisma as never);
    await expect(
      service.recordDisclosure('dealer-1', 'dealer-2-deal-product', {
        commissionDisclosed: true,
        customerSignatureUrl: 'sig.png',
      } as never),
    ).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'dealer-2-deal-product', product: { dealerId: 'dealer-1' } } }),
    );
  });

  it('records the disclosure once ownership is verified', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'disclosure-1' });
    const prisma = {
      dealFinanceProduct: { findFirst: jest.fn().mockResolvedValue({ id: 'deal-product-1' }) },
      fcaDisclosure: { create },
    };
    const service = new FiService(prisma as never);
    await service.recordDisclosure('dealer-1', 'deal-product-1', {
      commissionDisclosed: true,
      customerSignatureUrl: 'sig.png',
    } as never);
    expect(create).toHaveBeenCalled();
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

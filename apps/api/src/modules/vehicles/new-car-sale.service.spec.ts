import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DealSheetStatus, SaleModel } from '@project-amx/shared';
import { NewCarSaleService } from './new-car-sale.service';

function makeDeps() {
  return {
    pdf: { renderAndStore: jest.fn().mockResolvedValue('https://files.local/new-car-sales/sale-1.html') },
    documentSequences: { nextNumber: jest.fn().mockResolvedValue('NCS-2026-00001') },
    documentTemplates: { getDefaultBody: jest.fn().mockResolvedValue('<html></html>') },
    tradeIn: { intake: jest.fn().mockResolvedValue({ usedVehicle: { id: 'trade-in-vehicle' }, appraisal: { id: 'appraisal-1' } }) },
    ledger: { postSafely: jest.fn() },
  };
}

function makeService(prisma: Record<string, unknown>, deps = makeDeps()) {
  return {
    service: new NewCarSaleService(
      prisma as never,
      deps.pdf as never,
      deps.documentSequences as never,
      deps.documentTemplates as never,
      deps.tradeIn as never,
      deps.ledger as never,
    ),
    deps,
  };
}

describe('NewCarSaleService.create', () => {
  const dealerId = 'dealer-1';
  const vehicleId = 'vehicle-1';

  it('throws when the vehicle does not belong to this dealer', async () => {
    const prisma = { vehicle: { findFirst: jest.fn().mockResolvedValue(null) } };
    const { service } = makeService(prisma);
    await expect(service.create(dealerId, vehicleId, { saleModel: SaleModel.RETAIL, sellingPrice: 30000 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuses a new sale while this vehicle already has an ACTIVE one', async () => {
    const create = jest.fn();
    const prisma = {
      vehicle: { findFirst: jest.fn().mockResolvedValue({ id: vehicleId }) },
      newCarSale: { findFirst: jest.fn().mockResolvedValue({ id: 'existing-sale', status: DealSheetStatus.ACTIVE }), create },
    };
    const { service } = makeService(prisma);
    await expect(service.create(dealerId, vehicleId, { saleModel: SaleModel.RETAIL, sellingPrice: 30000 })).rejects.toThrow(
      BadRequestException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects agencyCommission on a RETAIL sale', async () => {
    const prisma = {
      vehicle: { findFirst: jest.fn().mockResolvedValue({ id: vehicleId }) },
      newCarSale: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const { service } = makeService(prisma);
    await expect(
      service.create(dealerId, vehicleId, { saleModel: SaleModel.RETAIL, sellingPrice: 30000, agencyCommission: 500 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates an AGENCY sale with its commission', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'sale-1', ...data }));
    const prisma = {
      vehicle: { findFirst: jest.fn().mockResolvedValue({ id: vehicleId }) },
      newCarSale: { findFirst: jest.fn().mockResolvedValue(null), create },
      dealer: { findUnique: jest.fn().mockResolvedValue({ id: dealerId, name: 'Test Dealer' }) },
    };
    const { service } = makeService(prisma);

    const result = await service.create(dealerId, vehicleId, { saleModel: SaleModel.AGENCY, sellingPrice: 45000, agencyCommission: 900 });

    expect(result.saleModel).toBe(SaleModel.AGENCY);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ saleModel: SaleModel.AGENCY, sellingPrice: 45000, agencyCommission: 900 }) }),
    );
  });

  it('intakes a trade-in vehicle and uses its agreed value as the sale\'s partExchangeValue', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'sale-1', ...data }));
    const prisma = {
      vehicle: { findFirst: jest.fn().mockResolvedValue({ id: vehicleId }) },
      newCarSale: { findFirst: jest.fn().mockResolvedValue(null), create },
      dealer: { findUnique: jest.fn().mockResolvedValue({ id: dealerId, name: 'Test Dealer' }) },
    };
    const { service, deps } = makeService(prisma);
    const tradeInDto = { reg: 'AB12CDE', make: 'Ford', model: 'Focus', agreedValue: 4000 };

    await service.create(dealerId, vehicleId, { saleModel: SaleModel.RETAIL, sellingPrice: 30000, tradeIn: tradeInDto });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ partExchangeValue: 4000 }) }));
    expect(deps.tradeIn.intake).toHaveBeenCalledWith(dealerId, tradeInDto, { newCarSaleId: 'sale-1' });
  });
});

describe('NewCarSaleService.invalidate', () => {
  const dealerId = 'dealer-1';
  const vehicleId = 'vehicle-1';

  it('throws when the sale does not belong to this dealer/vehicle', async () => {
    const update = jest.fn();
    const prisma = { newCarSale: { findFirst: jest.fn().mockResolvedValue(null), update } };
    const { service } = makeService(prisma);
    await expect(service.invalidate(dealerId, vehicleId, 'sale-1', {})).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses to invalidate a sale that is not ACTIVE', async () => {
    const update = jest.fn();
    const prisma = { newCarSale: { findFirst: jest.fn().mockResolvedValue({ id: 'sale-1', status: DealSheetStatus.SIGNED }), update } };
    const { service } = makeService(prisma);
    await expect(service.invalidate(dealerId, vehicleId, 'sale-1', {})).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('invalidates an ACTIVE sale with the given reason', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'sale-1', status: DealSheetStatus.INVALIDATED });
    const prisma = { newCarSale: { findFirst: jest.fn().mockResolvedValue({ id: 'sale-1', status: DealSheetStatus.ACTIVE }), update } };
    const { service } = makeService(prisma);

    await service.invalidate(dealerId, vehicleId, 'sale-1', { reason: 'Finance fell through' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: { status: DealSheetStatus.INVALIDATED, invalidatedAt: expect.any(Date), invalidatedReason: 'Finance fell through' },
    });
  });
});

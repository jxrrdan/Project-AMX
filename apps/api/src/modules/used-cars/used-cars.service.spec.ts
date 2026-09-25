import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DealSheetStatus, UsedVehicleStatus } from '@project-amx/shared';
import { UsedCarsService } from './used-cars.service';

function makePdf() {
  return { renderAndStore: jest.fn().mockResolvedValue('https://files.local/deal-sheets/deal-1.html') };
}

function makeDocumentSequences() {
  return { nextNumber: jest.fn().mockResolvedValue('DS-2026-00001') };
}

function makeDocumentTemplates() {
  return { getDefaultBody: jest.fn().mockResolvedValue('<html></html>') };
}

function makeActionTriggers() {
  return { run: jest.fn().mockResolvedValue(null) };
}

function makeTradeIn() {
  return { intake: jest.fn().mockResolvedValue({ usedVehicle: { id: 'trade-in-vehicle' }, appraisal: { id: 'appraisal-1' } }) };
}

function makeLedger() {
  return { postSafely: jest.fn() };
}

function makeValuation() {
  return { getValuation: jest.fn() };
}

describe('UsedCarsService.create', () => {
  const dealerId = 'dealer-1';

  it('posts the purchase price into Vehicle Stock against Creditors Control', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'vehicle-1', reg: 'AB12CDE' });
    const prisma = { usedVehicle: { create } };
    const ledger = makeLedger();
    const service = new UsedCarsService(
      prisma as never,
      makePdf() as never,
      makeDocumentSequences() as never,
      makeDocumentTemplates() as never,
      makeActionTriggers() as never,
      makeTradeIn() as never,
      ledger as never,
      makeValuation() as never,
    );

    await service.create(dealerId, { reg: 'AB12CDE', make: 'Ford', model: 'Focus', purchasePrice: 8000 } as never);

    expect(ledger.postSafely).toHaveBeenCalledWith(
      dealerId,
      expect.objectContaining({
        lines: expect.arrayContaining([expect.objectContaining({ debit: 8000 }), expect.objectContaining({ credit: 8000 })]),
      }),
    );
  });

  it('does not post to the ledger when no purchase price is given', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'vehicle-1', reg: 'AB12CDE' });
    const prisma = { usedVehicle: { create } };
    const ledger = makeLedger();
    const service = new UsedCarsService(
      prisma as never,
      makePdf() as never,
      makeDocumentSequences() as never,
      makeDocumentTemplates() as never,
      makeActionTriggers() as never,
      makeTradeIn() as never,
      ledger as never,
      makeValuation() as never,
    );

    await service.create(dealerId, { reg: 'AB12CDE', make: 'Ford', model: 'Focus' } as never);

    expect(ledger.postSafely).not.toHaveBeenCalled();
  });
});

describe('UsedCarsService.createDealSheet', () => {
  const dealerId = 'dealer-1';
  const usedVehicleId = 'vehicle-1';

  it('throws when the vehicle does not belong to this dealer', async () => {
    const prisma = { usedVehicle: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, makeTradeIn() as never, makeLedger() as never, makeValuation() as never);
    await expect(
      service.createDealSheet(dealerId, usedVehicleId, { sellingPrice: 15000 } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('sums the accessory lines into accessoriesTotal and adds them on top of gross profit', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue({ id: usedVehicleId, purchasePrice: 12000 }) },
      dealSheet: { create, findFirst: jest.fn().mockResolvedValue(null) },
      dealer: { findUnique: jest.fn().mockResolvedValue({ id: dealerId, name: 'Test Dealer' }) },
    };
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, makeTradeIn() as never, makeLedger() as never, makeValuation() as never);

    const result = await service.createDealSheet(dealerId, usedVehicleId, {
      sellingPrice: 15000,
      accessories: [
        { description: 'Mudflaps', price: 50 },
        { description: 'Tow bar', price: 200 },
      ],
    } as never);

    // grossProfit = sellingPrice(15000) - purchasePrice(12000) + accessoriesTotal(250)
    expect(result.accessoriesTotal).toBe(250);
    expect(result.grossProfit).toBe(3250);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessoriesTotal: 250,
          grossProfit: 3250,
          accessoryLines: { create: [{ description: 'Mudflaps', price: 50 }, { description: 'Tow bar', price: 200 }] },
        }),
      }),
    );
  });

  it('treats a deal sheet with no accessories as a zero accessories total', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue({ id: usedVehicleId, purchasePrice: 12000 }) },
      dealSheet: { create, findFirst: jest.fn().mockResolvedValue(null) },
      dealer: { findUnique: jest.fn().mockResolvedValue({ id: dealerId, name: 'Test Dealer' }) },
    };
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, makeTradeIn() as never, makeLedger() as never, makeValuation() as never);

    const result = await service.createDealSheet(dealerId, usedVehicleId, { sellingPrice: 15000 } as never);

    expect(result.accessoriesTotal).toBe(0);
    expect(result.grossProfit).toBe(3000);
  });

  it('treats a missing purchase price as zero cost rather than throwing', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue({ id: usedVehicleId, purchasePrice: null }) },
      dealSheet: { create, findFirst: jest.fn().mockResolvedValue(null) },
      dealer: { findUnique: jest.fn().mockResolvedValue({ id: dealerId, name: 'Test Dealer' }) },
    };
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, makeTradeIn() as never, makeLedger() as never, makeValuation() as never);

    const result = await service.createDealSheet(dealerId, usedVehicleId, { sellingPrice: 15000 } as never);

    expect(result.grossProfit).toBe(15000);
  });

  it('refuses a new deal sheet while this vehicle already has an ACTIVE one — it must be invalidated first', async () => {
    const create = jest.fn();
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue({ id: usedVehicleId, purchasePrice: 12000 }) },
      dealSheet: { create, findFirst: jest.fn().mockResolvedValue({ id: 'existing-deal', status: DealSheetStatus.ACTIVE }) },
    };
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, makeTradeIn() as never, makeLedger() as never, makeValuation() as never);

    await expect(service.createDealSheet(dealerId, usedVehicleId, { sellingPrice: 15000 } as never)).rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('allows a new deal sheet once the previous one has been invalidated', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue({ id: usedVehicleId, purchasePrice: 12000 }) },
      dealSheet: { create, findFirst: jest.fn().mockResolvedValue(null) },
      dealer: { findUnique: jest.fn().mockResolvedValue({ id: dealerId, name: 'Test Dealer' }) },
    };
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, makeTradeIn() as never, makeLedger() as never, makeValuation() as never);

    const result = await service.createDealSheet(dealerId, usedVehicleId, { sellingPrice: 15000 } as never);

    expect(result.status).toBe(DealSheetStatus.ACTIVE);
  });

  it('intakes a trade-in vehicle and uses its agreed value as the deal sheet\'s partExchangeValue', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'deal-1', ...data }));
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue({ id: usedVehicleId, purchasePrice: 12000 }) },
      dealSheet: { create, findFirst: jest.fn().mockResolvedValue(null) },
      dealer: { findUnique: jest.fn().mockResolvedValue({ id: dealerId, name: 'Test Dealer' }) },
    };
    const tradeIn = makeTradeIn();
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, tradeIn as never, makeLedger() as never, makeValuation() as never);

    const tradeInDto = { reg: 'AB12CDE', make: 'Ford', model: 'Focus', agreedValue: 3000 };
    await service.createDealSheet(dealerId, usedVehicleId, { sellingPrice: 15000, tradeIn: tradeInDto } as never);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ partExchangeValue: 3000 }) }),
    );
    expect(tradeIn.intake).toHaveBeenCalledWith(dealerId, tradeInDto, { dealSheetId: 'deal-1' });
  });

  it('does not attempt a trade-in intake when none is given', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'deal-1', ...data }));
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue({ id: usedVehicleId, purchasePrice: 12000 }) },
      dealSheet: { create, findFirst: jest.fn().mockResolvedValue(null) },
      dealer: { findUnique: jest.fn().mockResolvedValue({ id: dealerId, name: 'Test Dealer' }) },
    };
    const tradeIn = makeTradeIn();
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, tradeIn as never, makeLedger() as never, makeValuation() as never);

    await service.createDealSheet(dealerId, usedVehicleId, { sellingPrice: 15000 } as never);

    expect(tradeIn.intake).not.toHaveBeenCalled();
  });
});

describe('UsedCarsService.invalidateDealSheet', () => {
  const dealerId = 'dealer-1';
  const usedVehicleId = 'vehicle-1';

  it('throws when the deal sheet does not belong to this dealer', async () => {
    const update = jest.fn();
    const prisma = { dealSheet: { findFirst: jest.fn().mockResolvedValue(null), update } };
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, makeTradeIn() as never, makeLedger() as never, makeValuation() as never);
    await expect(service.invalidateDealSheet(dealerId, usedVehicleId, 'deal-1', {})).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses to invalidate a deal sheet that is not ACTIVE', async () => {
    const update = jest.fn();
    const prisma = { dealSheet: { findFirst: jest.fn().mockResolvedValue({ id: 'deal-1', status: DealSheetStatus.SIGNED }), update } };
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, makeTradeIn() as never, makeLedger() as never, makeValuation() as never);
    await expect(service.invalidateDealSheet(dealerId, usedVehicleId, 'deal-1', {})).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('invalidates an ACTIVE deal sheet with the given reason', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'deal-1', status: DealSheetStatus.INVALIDATED });
    const prisma = { dealSheet: { findFirst: jest.fn().mockResolvedValue({ id: 'deal-1', status: DealSheetStatus.ACTIVE }), update } };
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, makeTradeIn() as never, makeLedger() as never, makeValuation() as never);

    await service.invalidateDealSheet(dealerId, usedVehicleId, 'deal-1', { reason: 'Buyer withdrew' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'deal-1' },
      data: { status: DealSheetStatus.INVALIDATED, invalidatedAt: expect.any(Date), invalidatedReason: 'Buyer withdrew' },
    });
  });
});

describe('UsedCarsService.updateStatus', () => {
  const dealerId = 'dealer-1';

  it('marks the ACTIVE deal sheet as SIGNED when the vehicle moves to SOLD, and posts the sale to the ledger', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findFirst = jest.fn().mockResolvedValue({ id: 'deal-1', sellingPrice: 15000 });
    const prisma = {
      usedVehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'vehicle-1', reg: 'AB12CDE', purchasePrice: 12000 }),
        update: jest.fn().mockResolvedValue({ id: 'vehicle-1', status: UsedVehicleStatus.SOLD }),
      },
      dealSheet: { updateMany, findFirst },
    };
    const ledger = makeLedger();
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, makeTradeIn() as never, ledger as never, makeValuation() as never);

    await service.updateStatus(dealerId, 'vehicle-1', { status: UsedVehicleStatus.SOLD });

    expect(updateMany).toHaveBeenCalledWith({
      where: { usedVehicleId: 'vehicle-1', status: DealSheetStatus.ACTIVE },
      data: { status: DealSheetStatus.SIGNED },
    });
    expect(ledger.postSafely).toHaveBeenCalledWith(
      dealerId,
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({ debit: 15000 }),
          expect.objectContaining({ credit: 15000 }),
          expect.objectContaining({ debit: 12000 }),
          expect.objectContaining({ credit: 12000 }),
        ]),
      }),
    );
  });

  it('does not touch deal sheets for any other status transition', async () => {
    const updateMany = jest.fn();
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'vehicle-1' }), update: jest.fn().mockResolvedValue({ id: 'vehicle-1', status: UsedVehicleStatus.LISTED }) },
      dealSheet: { updateMany },
    };
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, makeTradeIn() as never, makeLedger() as never, makeValuation() as never);

    await service.updateStatus(dealerId, 'vehicle-1', { status: UsedVehicleStatus.LISTED });

    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe('UsedCarsService.getValuation', () => {
  const dealerId = 'dealer-1';

  it('throws when the vehicle does not belong to this dealer', async () => {
    const prisma = { usedVehicle: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new UsedCarsService(
      prisma as never,
      makePdf() as never,
      makeDocumentSequences() as never,
      makeDocumentTemplates() as never,
      makeActionTriggers() as never,
      makeTradeIn() as never,
      makeLedger() as never,
      makeValuation() as never,
    );
    await expect(service.getValuation(dealerId, 'missing')).rejects.toThrow(NotFoundException);
  });

  it('calls the valuation service with the vehicle\'s reg and mileage', async () => {
    const prisma = { usedVehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'v1', reg: 'AB12CDE', mileage: 40000 }) } };
    const valuation = { getValuation: jest.fn().mockResolvedValue({ privateRetailValue: 15000 }) };
    const service = new UsedCarsService(
      prisma as never,
      makePdf() as never,
      makeDocumentSequences() as never,
      makeDocumentTemplates() as never,
      makeActionTriggers() as never,
      makeTradeIn() as never,
      makeLedger() as never,
      valuation as never,
    );
    await service.getValuation(dealerId, 'v1');
    expect(valuation.getValuation).toHaveBeenCalledWith('AB12CDE', 40000);
  });
});

describe('UsedCarsService.regLookup', () => {
  const dealerId = 'dealer-1';

  it('returns the existing vehicle and null enrichment when no action trigger is configured', async () => {
    const vehicle = { id: 'v1', reg: 'AB12CDE', dealerId };
    const prisma = { usedVehicle: { findFirst: jest.fn().mockResolvedValue(vehicle) } };
    const actionTriggers = makeActionTriggers();
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, actionTriggers as never, makeTradeIn() as never, makeLedger() as never, makeValuation() as never);

    const result = await service.regLookup(dealerId, 'AB12CDE');

    expect(result).toEqual({ existingVehicle: vehicle, enrichment: null });
    expect(prisma.usedVehicle.findFirst).toHaveBeenCalledWith({ where: { dealerId, reg: 'AB12CDE' } });
  });

  it('returns enrichment from the configured action trigger alongside the DB search', async () => {
    const prisma = { usedVehicle: { findFirst: jest.fn().mockResolvedValue(null) } };
    const enrichment = { triggerName: 'OEM lookup', columnValues: { colour: 'Black' }, customFieldValues: {} };
    const actionTriggers = { run: jest.fn().mockResolvedValue(enrichment) };
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, actionTriggers as never, makeTradeIn() as never, makeLedger() as never, makeValuation() as never);

    const result = await service.regLookup(dealerId, 'AB12CDE');

    expect(result).toEqual({ existingVehicle: null, enrichment });
  });
});

describe('UsedCarsService.addPhotos', () => {
  it('refuses to add photos to a vehicle belonging to another dealer', async () => {
    const createMany = jest.fn();
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue(null) },
      vehiclePhoto: { createMany },
    };
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, makeTradeIn() as never, makeLedger() as never, makeValuation() as never);
    await expect(
      service.addPhotos('dealer-1', 'other-dealer-vehicle', { urls: ['https://x/1.jpg'] } as never),
    ).rejects.toThrow(NotFoundException);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('adds the photos once the vehicle is confirmed to belong to this dealer', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'vehicle-1' }) },
      vehiclePhoto: { createMany },
    };
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, makeTradeIn() as never, makeLedger() as never, makeValuation() as never);
    await service.addPhotos('dealer-1', 'vehicle-1', { urls: ['https://x/1.jpg', 'https://x/2.jpg'] } as never);
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          { usedVehicleId: 'vehicle-1', url: 'https://x/1.jpg', sortOrder: 0 },
          { usedVehicleId: 'vehicle-1', url: 'https://x/2.jpg', sortOrder: 1 },
        ],
      }),
    );
  });
});

describe('UsedCarsService.daysInStockAlerts', () => {
  it('only flags vehicles that have crossed the 30/60/90-day thresholds', async () => {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
    const prisma = {
      usedVehicle: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'fresh', createdAt: daysAgo(10) },
          { id: 'thirty', createdAt: daysAgo(31) },
          { id: 'ninety', createdAt: daysAgo(95) },
        ]),
      },
    };
    const service = new UsedCarsService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeActionTriggers() as never, makeTradeIn() as never, makeLedger() as never, makeValuation() as never);
    const alerts = await service.daysInStockAlerts('dealer-1');
    expect(alerts.map((v) => v.id)).toEqual(['thirty', 'ninety']);
  });
});

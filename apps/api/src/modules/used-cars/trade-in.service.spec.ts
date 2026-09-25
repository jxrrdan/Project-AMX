import { VehicleSource } from '@project-amx/shared';
import { TradeInService } from './trade-in.service';

function makePrisma() {
  return {
    usedVehicle: { create: jest.fn().mockResolvedValue({ id: 'used-vehicle-1', reg: 'AB12CDE' }) },
    partExchangeAppraisal: { create: jest.fn().mockResolvedValue({ id: 'appraisal-1' }) },
  };
}

function makeLedger() {
  return { postSafely: jest.fn() };
}

describe('TradeInService.intake', () => {
  const dealerId = 'dealer-1';
  const tradeIn = { reg: 'AB12CDE', make: 'Ford', model: 'Focus', mileage: 40000, condition: 'Good', agreedValue: 3000 };

  it('creates a new used-vehicle stock record with source PART_EX at the agreed value', async () => {
    const prisma = makePrisma();
    const service = new TradeInService(prisma as never, makeLedger() as never);

    await service.intake(dealerId, tradeIn, { dealSheetId: 'deal-1' });

    expect(prisma.usedVehicle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dealerId,
        reg: 'AB12CDE',
        make: 'Ford',
        model: 'Focus',
        mileage: 40000,
        source: VehicleSource.PART_EX,
        purchasePrice: 3000,
      }),
    });
  });

  it('links the appraisal to a deal sheet when given one', async () => {
    const prisma = makePrisma();
    const service = new TradeInService(prisma as never, makeLedger() as never);

    await service.intake(dealerId, tradeIn, { dealSheetId: 'deal-1' });

    expect(prisma.partExchangeAppraisal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ usedVehicleId: 'used-vehicle-1', dealSheetId: 'deal-1', newCarSaleId: undefined, agreedValue: 3000 }),
    });
  });

  it('links the appraisal to a new-car sale when given one', async () => {
    const prisma = makePrisma();
    const service = new TradeInService(prisma as never, makeLedger() as never);

    await service.intake(dealerId, tradeIn, { newCarSaleId: 'sale-1' });

    expect(prisma.partExchangeAppraisal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ usedVehicleId: 'used-vehicle-1', dealSheetId: undefined, newCarSaleId: 'sale-1' }),
    });
  });

  it('posts the agreed value into Vehicle Stock against Creditors Control', async () => {
    const prisma = makePrisma();
    const ledger = makeLedger();
    const service = new TradeInService(prisma as never, ledger as never);

    await service.intake(dealerId, tradeIn, { dealSheetId: 'deal-1' });

    expect(ledger.postSafely).toHaveBeenCalledWith(
      dealerId,
      expect.objectContaining({
        lines: expect.arrayContaining([expect.objectContaining({ debit: 3000 }), expect.objectContaining({ credit: 3000 })]),
      }),
    );
  });
});

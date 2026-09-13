import { NotFoundException } from '@nestjs/common';
import { UsedCarsService } from './used-cars.service';

function makePdf() {
  return { renderAndStore: jest.fn().mockResolvedValue('https://files.local/deal-sheets/deal-1.html') };
}

describe('UsedCarsService.createDealSheet', () => {
  const dealerId = 'dealer-1';
  const usedVehicleId = 'vehicle-1';

  it('throws when the vehicle does not belong to this dealer', async () => {
    const prisma = { usedVehicle: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new UsedCarsService(prisma as never, makePdf() as never);
    await expect(
      service.createDealSheet(dealerId, usedVehicleId, { sellingPrice: 15000 } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('sums the accessory lines into accessoriesTotal and adds them on top of gross profit', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue({ id: usedVehicleId, purchasePrice: 12000 }) },
      dealSheet: { create },
    };
    const service = new UsedCarsService(prisma as never, makePdf() as never);

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
      dealSheet: { create },
    };
    const service = new UsedCarsService(prisma as never, makePdf() as never);

    const result = await service.createDealSheet(dealerId, usedVehicleId, { sellingPrice: 15000 } as never);

    expect(result.accessoriesTotal).toBe(0);
    expect(result.grossProfit).toBe(3000);
  });

  it('treats a missing purchase price as zero cost rather than throwing', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue({ id: usedVehicleId, purchasePrice: null }) },
      dealSheet: { create },
    };
    const service = new UsedCarsService(prisma as never, makePdf() as never);

    const result = await service.createDealSheet(dealerId, usedVehicleId, { sellingPrice: 15000 } as never);

    expect(result.grossProfit).toBe(15000);
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
    const service = new UsedCarsService(prisma as never, makePdf() as never);
    const alerts = await service.daysInStockAlerts('dealer-1');
    expect(alerts.map((v) => v.id)).toEqual(['thirty', 'ninety']);
  });
});

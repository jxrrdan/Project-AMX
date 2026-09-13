import { VhcRating } from '@project-amx/shared';
import { VhcService } from './vhc.service';

function makeEmail() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

describe('VhcService.addItem', () => {
  it('rejects an Amber item with no photo', () => {
    const prisma = { vhcItem: { create: jest.fn() } };
    const service = new VhcService(prisma as never, makeEmail() as never);
    expect(() =>
      service.addItem('inspection-1', { rating: VhcRating.AMBER, label: 'Brake pads', photoUrls: [] } as never),
    ).toThrow('A photo is required for Amber/Red items');
    expect(prisma.vhcItem.create).not.toHaveBeenCalled();
  });

  it('rejects a Red item with an undefined photoUrls field', () => {
    const prisma = { vhcItem: { create: jest.fn() } };
    const service = new VhcService(prisma as never, makeEmail() as never);
    expect(() => service.addItem('inspection-1', { rating: VhcRating.RED, label: 'Tyres' } as never)).toThrow(
      'A photo is required for Amber/Red items',
    );
  });

  it('allows a Green item with no photo', () => {
    const prisma = { vhcItem: { create: jest.fn().mockResolvedValue({ id: 'item-1' }) } };
    const service = new VhcService(prisma as never, makeEmail() as never);
    service.addItem('inspection-1', { rating: VhcRating.GREEN, label: 'Wipers' } as never);
    expect(prisma.vhcItem.create).toHaveBeenCalled();
  });

  it('allows an Amber item once at least one photo is attached', () => {
    const prisma = { vhcItem: { create: jest.fn().mockResolvedValue({ id: 'item-1' }) } };
    const service = new VhcService(prisma as never, makeEmail() as never);
    service.addItem('inspection-1', {
      rating: VhcRating.AMBER,
      label: 'Brake pads',
      photoUrls: ['https://example.com/pad.jpg'],
    } as never);
    expect(prisma.vhcItem.create).toHaveBeenCalled();
  });
});

describe('VhcService.respondToItem', () => {
  it('creates a follow-up job card when the customer approves the item', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = {
      vhcItem: {
        update: jest.fn().mockResolvedValue({
          id: 'item-1',
          label: 'Brake pads',
          description: 'Worn to 2mm',
          estimatedLabourMinutes: 90,
          inspection: { dealerId: 'dealer-1', vehicleReg: 'AB12CDE' },
        }),
      },
      jobCard: { create },
    };
    const service = new VhcService(prisma as never, makeEmail() as never);
    await service.respondToItem('item-1', { approved: true });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dealerId: 'dealer-1', vehicleReg: 'AB12CDE', estimatedHours: 1.5 }),
      }),
    );
  });

  it('does not create a job card when the customer declines the item', async () => {
    const create = jest.fn();
    const prisma = {
      vhcItem: {
        update: jest.fn().mockResolvedValue({
          id: 'item-1',
          label: 'Brake pads',
          inspection: { dealerId: 'dealer-1', vehicleReg: 'AB12CDE' },
        }),
      },
      jobCard: { create },
    };
    const service = new VhcService(prisma as never, makeEmail() as never);
    await service.respondToItem('item-1', { approved: false });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('VhcService.conversionRate', () => {
  it('computes the share of presented Amber/Red items the customer approved', async () => {
    const prisma = {
      vhcItem: {
        findMany: jest.fn().mockResolvedValue([
          { approved: true },
          { approved: false },
          { approved: null },
          { approved: true },
        ]),
      },
    };
    const service = new VhcService(prisma as never, makeEmail() as never);
    const result = await service.conversionRate('dealer-1');
    // Only responded items (3) count toward the rate; 2 of those were approved.
    expect(result).toEqual({ presented: 4, approved: 2, conversionRate: 2 / 3 });
  });

  it('reports a zero rate rather than dividing by zero when nothing has been responded to yet', async () => {
    const prisma = { vhcItem: { findMany: jest.fn().mockResolvedValue([{ approved: null }]) } };
    const service = new VhcService(prisma as never, makeEmail() as never);
    const result = await service.conversionRate('dealer-1');
    expect(result.conversionRate).toBe(0);
  });
});

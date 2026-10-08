import { NotFoundException } from '@nestjs/common';
import { VhcRating } from '@project-amx/shared';
import { VhcService } from './vhc.service';

function makeConfig() {
  return { get: jest.fn((key: string, fallback?: string) => (key === 'JWT_ACCESS_SECRET' ? 'test-secret' : fallback)) };
}

function makeEmail() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    vhcInspection: { findFirst: jest.fn().mockResolvedValue({ id: 'inspection-1', dealerId: 'dealer-1' }) },
    vhcItem: { create: jest.fn().mockResolvedValue({ id: 'item-1' }) },
    ...overrides,
  };
}

describe('VhcService.addItem', () => {
  it('refuses to add an item to another dealer\'s inspection', async () => {
    const prisma = makePrisma({ vhcInspection: { findFirst: jest.fn().mockResolvedValue(null) } });
    const service = new VhcService(prisma as never, makeEmail() as never, makeConfig() as never);
    await expect(
      service.addItem('dealer-1', 'other-dealer-inspection', { rating: VhcRating.GREEN, label: 'Wipers' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.vhcItem.create).not.toHaveBeenCalled();
  });

  it('rejects an Amber item with no photo', async () => {
    const prisma = makePrisma();
    const service = new VhcService(prisma as never, makeEmail() as never, makeConfig() as never);
    await expect(
      service.addItem('dealer-1', 'inspection-1', { rating: VhcRating.AMBER, label: 'Brake pads', photoUrls: [] } as never),
    ).rejects.toThrow('A photo is required for Amber/Red items');
    expect(prisma.vhcItem.create).not.toHaveBeenCalled();
  });

  it('rejects a Red item with an undefined photoUrls field', async () => {
    const prisma = makePrisma();
    const service = new VhcService(prisma as never, makeEmail() as never, makeConfig() as never);
    await expect(
      service.addItem('dealer-1', 'inspection-1', { rating: VhcRating.RED, label: 'Tyres' } as never),
    ).rejects.toThrow('A photo is required for Amber/Red items');
  });

  it('allows a Green item with no photo', async () => {
    const prisma = makePrisma();
    const service = new VhcService(prisma as never, makeEmail() as never, makeConfig() as never);
    await service.addItem('dealer-1', 'inspection-1', { rating: VhcRating.GREEN, label: 'Wipers' } as never);
    expect(prisma.vhcItem.create).toHaveBeenCalled();
  });

  it('allows an Amber item once at least one photo is attached', async () => {
    const prisma = makePrisma();
    const service = new VhcService(prisma as never, makeEmail() as never, makeConfig() as never);
    await service.addItem('dealer-1', 'inspection-1', {
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
        findUnique: jest.fn().mockResolvedValue({ id: 'item-1', inspectionId: 'inspection-1', respondedAt: null }),
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
    const service = new VhcService(prisma as never, makeEmail() as never, makeConfig() as never);
    await service.respondToItem('item-1', service.reportToken('inspection-1'), { approved: true });

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
        findUnique: jest.fn().mockResolvedValue({ id: 'item-1', inspectionId: 'inspection-1', respondedAt: null }),
        update: jest.fn().mockResolvedValue({
          id: 'item-1',
          label: 'Brake pads',
          inspection: { dealerId: 'dealer-1', vehicleReg: 'AB12CDE' },
        }),
      },
      jobCard: { create },
    };
    const service = new VhcService(prisma as never, makeEmail() as never, makeConfig() as never);
    await service.respondToItem('item-1', service.reportToken('inspection-1'), { approved: false });
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
    const service = new VhcService(prisma as never, makeEmail() as never, makeConfig() as never);
    const result = await service.conversionRate('dealer-1');
    // Only responded items (3) count toward the rate; 2 of those were approved.
    expect(result).toEqual({ presented: 4, approved: 2, conversionRate: 2 / 3 });
  });

  it('reports a zero rate rather than dividing by zero when nothing has been responded to yet', async () => {
    const prisma = { vhcItem: { findMany: jest.fn().mockResolvedValue([{ approved: null }]) } };
    const service = new VhcService(prisma as never, makeEmail() as never, makeConfig() as never);
    const result = await service.conversionRate('dealer-1');
    expect(result.conversionRate).toBe(0);
  });
});

describe('VhcService public report access', () => {
  const inspection = { id: 'inspection-1', dealerId: 'dealer-1', technicianId: 'tech-1', jobCardId: 'job-1', vehicleReg: 'AB12CDE', items: [] };

  it('rejects the report without a valid token and never queries the database', async () => {
    const prisma = { vhcInspection: { findUnique: jest.fn() } };
    const service = new VhcService(prisma as never, makeEmail() as never, makeConfig() as never);
    await expect(service.findPublic('inspection-1', undefined)).rejects.toThrow(NotFoundException);
    await expect(service.findPublic('inspection-1', 'forged')).rejects.toThrow(NotFoundException);
    expect(prisma.vhcInspection.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a token issued for a different inspection', async () => {
    const prisma = { vhcInspection: { findUnique: jest.fn() } };
    const service = new VhcService(prisma as never, makeEmail() as never, makeConfig() as never);
    await expect(service.findPublic('inspection-1', service.reportToken('inspection-2'))).rejects.toThrow(NotFoundException);
  });

  it('rejects an expired token', async () => {
    const prisma = { vhcInspection: { findUnique: jest.fn() } };
    const service = new VhcService(prisma as never, makeEmail() as never, makeConfig() as never);
    await expect(service.findPublic('inspection-1', service.reportToken('inspection-1', Date.now() - 1000))).rejects.toThrow(NotFoundException);
  });

  it('returns the report with internal ids stripped when the token is valid', async () => {
    const prisma = { vhcInspection: { findUnique: jest.fn().mockResolvedValue(inspection) } };
    const service = new VhcService(prisma as never, makeEmail() as never, makeConfig() as never);
    const report = await service.findPublic('inspection-1', service.reportToken('inspection-1'));
    expect(report).toEqual({ id: 'inspection-1', vehicleReg: 'AB12CDE', items: [] });
  });

  it('refuses to respond to an item with a bad token or one already answered', async () => {
    const prisma = {
      vhcItem: { findUnique: jest.fn().mockResolvedValue({ id: 'item-1', inspectionId: 'inspection-1', respondedAt: null }), update: jest.fn() },
      jobCard: { create: jest.fn() },
    };
    const service = new VhcService(prisma as never, makeEmail() as never, makeConfig() as never);
    await expect(service.respondToItem('item-1', 'forged', { approved: true })).rejects.toThrow(NotFoundException);
    prisma.vhcItem.findUnique.mockResolvedValue({ id: 'item-1', inspectionId: 'inspection-1', respondedAt: new Date() });
    await expect(service.respondToItem('item-1', service.reportToken('inspection-1'), { approved: true })).rejects.toThrow('already been answered');
    expect(prisma.vhcItem.update).not.toHaveBeenCalled();
    expect(prisma.jobCard.create).not.toHaveBeenCalled();
  });
});

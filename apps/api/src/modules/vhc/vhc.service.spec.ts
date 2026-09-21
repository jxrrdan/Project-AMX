import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VhcRating } from '@project-amx/shared';
import { VhcService } from './vhc.service';

function makeEmail() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    vhcInspection: { findFirst: jest.fn().mockResolvedValue({ id: 'inspection-1', dealerId: 'dealer-1' }) },
    vhcItem: {
      create: jest.fn().mockResolvedValue({ id: 'item-1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'item-1', estimatedLabourMinutes: null, estimatedPartsCost: null, parts: [] }),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'item-1', ...data })),
    },
    dealer: { findUnique: jest.fn().mockResolvedValue({ labourRatePerHour: 95 }) },
    ...overrides,
  };
}

describe('VhcService.addItem', () => {
  it('refuses to add an item to another dealer\'s inspection', async () => {
    const prisma = makePrisma({ vhcInspection: { findFirst: jest.fn().mockResolvedValue(null) } });
    const service = new VhcService(prisma as never, makeEmail() as never);
    await expect(
      service.addItem('dealer-1', 'other-dealer-inspection', { rating: VhcRating.GREEN, label: 'Wipers' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.vhcItem.create).not.toHaveBeenCalled();
  });

  it('rejects an Amber item with no photo', async () => {
    const prisma = makePrisma();
    const service = new VhcService(prisma as never, makeEmail() as never);
    await expect(
      service.addItem('dealer-1', 'inspection-1', { rating: VhcRating.AMBER, label: 'Brake pads', photoUrls: [] } as never),
    ).rejects.toThrow('A photo is required for Amber/Red items');
    expect(prisma.vhcItem.create).not.toHaveBeenCalled();
  });

  it('rejects a Red item with an undefined photoUrls field', async () => {
    const prisma = makePrisma();
    const service = new VhcService(prisma as never, makeEmail() as never);
    await expect(
      service.addItem('dealer-1', 'inspection-1', { rating: VhcRating.RED, label: 'Tyres' } as never),
    ).rejects.toThrow('A photo is required for Amber/Red items');
  });

  it('allows a Green item with no photo', async () => {
    const prisma = makePrisma();
    const service = new VhcService(prisma as never, makeEmail() as never);
    await service.addItem('dealer-1', 'inspection-1', { rating: VhcRating.GREEN, label: 'Wipers' } as never);
    expect(prisma.vhcItem.create).toHaveBeenCalled();
  });

  it('allows an Amber item once at least one photo is attached', async () => {
    const prisma = makePrisma();
    const service = new VhcService(prisma as never, makeEmail() as never);
    await service.addItem('dealer-1', 'inspection-1', {
      rating: VhcRating.AMBER,
      label: 'Brake pads',
      photoUrls: ['https://example.com/pad.jpg'],
    } as never);
    expect(prisma.vhcItem.create).toHaveBeenCalled();
  });
});

describe('VhcService.addItemPart / removeItemPart / auto-quote', () => {
  it('addItemPart refuses an item outside the caller\'s dealer', async () => {
    const prisma = makePrisma({ vhcItem: { findFirst: jest.fn().mockResolvedValue(null) } });
    const service = new VhcService(prisma as never, makeEmail() as never);
    await expect(service.addItemPart('dealer-1', 'other-dealer-item', { partId: 'part-1' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('addItemPart refuses a part outside the caller\'s dealer', async () => {
    const prisma = makePrisma({
      vhcItem: { findFirst: jest.fn().mockResolvedValue({ id: 'item-1' }) },
      part: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const service = new VhcService(prisma as never, makeEmail() as never);
    await expect(service.addItemPart('dealer-1', 'item-1', { partId: 'other-dealer-part' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('computes the quote from labour minutes at the dealer rate plus linked parts at their real cost price', async () => {
    const prisma = makePrisma({
      vhcItem: {
        findFirst: jest.fn().mockResolvedValue({ id: 'item-1' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'item-1',
          estimatedLabourMinutes: 60,
          estimatedPartsCost: null,
          parts: [{ quantity: 2, part: { costPrice: 15 } }],
        }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'item-1', ...data })),
      },
      part: { findFirst: jest.fn().mockResolvedValue({ id: 'part-1' }) },
      vhcItemPart: { create: jest.fn().mockResolvedValue({}) },
      dealer: { findUnique: jest.fn().mockResolvedValue({ labourRatePerHour: 80 }) },
    });
    const service = new VhcService(prisma as never, makeEmail() as never);

    const result = await service.addItemPart('dealer-1', 'item-1', { partId: 'part-1', quantity: 2 });

    // 60 min @ £80/hr = £80 labour; 2 * £15 = £30 parts; total £110.
    expect(result).toEqual(expect.objectContaining({ quotedLabourCost: 80, quotedPartsCost: 30, quotedTotal: 110 }));
  });

  it('falls back to the manually-typed estimatedPartsCost while no real part is linked', async () => {
    const prisma = makePrisma({
      vhcItem: {
        create: jest.fn().mockResolvedValue({ id: 'item-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'item-1', estimatedLabourMinutes: 30, estimatedPartsCost: 25, parts: [] }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'item-1', ...data })),
      },
      dealer: { findUnique: jest.fn().mockResolvedValue({ labourRatePerHour: 100 }) },
    });
    const service = new VhcService(prisma as never, makeEmail() as never);

    const item = await service.addItem('dealer-1', 'inspection-1', {
      rating: VhcRating.GREEN,
      label: 'Wipers',
    } as never);

    // 30 min @ £100/hr = £50 labour; no linked part -> falls back to the typed £25 estimate; total £75.
    expect(item).toEqual(expect.objectContaining({ quotedLabourCost: 50, quotedPartsCost: 25, quotedTotal: 75 }));
  });

  it('removeItemPart refuses a link outside the caller\'s dealer', async () => {
    const prisma = makePrisma({ vhcItemPart: { findFirst: jest.fn().mockResolvedValue(null) } });
    const service = new VhcService(prisma as never, makeEmail() as never);
    await expect(service.removeItemPart('dealer-1', 'other-dealer-link')).rejects.toThrow(NotFoundException);
  });
});

describe('VhcService.respondToItem', () => {
  function makeRespondPrisma(overrides: Record<string, unknown> = {}) {
    return {
      vhcItem: {
        update: jest.fn().mockResolvedValue({
          id: 'item-1',
          inspectionId: 'inspection-1',
          label: 'Brake pads',
          description: 'Worn to 2mm',
          estimatedLabourMinutes: 90,
          parts: [],
          inspection: {
            dealerId: 'dealer-1',
            vehicleReg: 'AB12CDE',
            jobCard: { customerName: 'Jamie Smith', contactId: 'contact-1', vehicleId: 'vehicle-1' },
          },
        }),
        findMany: jest.fn().mockResolvedValue([{ respondedAt: new Date() }]),
      },
      jobCard: { create: jest.fn().mockResolvedValue({ id: 'new-job-1' }) },
      jobCardPartRequirement: { createMany: jest.fn().mockResolvedValue({}) },
      vhcInspection: { update: jest.fn().mockResolvedValue({}) },
      ...overrides,
    };
  }

  it('creates a follow-up job card linked back to the source item, billed to the original customer', async () => {
    const prisma = makeRespondPrisma();
    const service = new VhcService(prisma as never, makeEmail() as never);
    await service.respondToItem('item-1', { approved: true });

    expect(prisma.jobCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dealerId: 'dealer-1',
          customerName: 'Jamie Smith',
          contactId: 'contact-1',
          vehicleId: 'vehicle-1',
          vehicleReg: 'AB12CDE',
          estimatedHours: 1.5,
          sourceVhcItemId: 'item-1',
        }),
      }),
    );
  });

  it('carries any linked parts onto the new job card as part requirements', async () => {
    const prisma = makeRespondPrisma({
      vhcItem: {
        update: jest.fn().mockResolvedValue({
          id: 'item-1',
          inspectionId: 'inspection-1',
          label: 'Brake pads',
          estimatedLabourMinutes: 90,
          parts: [{ partId: 'part-1', quantity: 2 }],
          inspection: { dealerId: 'dealer-1', vehicleReg: 'AB12CDE', jobCard: { customerName: 'Jamie Smith' } },
        }),
        findMany: jest.fn().mockResolvedValue([{ respondedAt: new Date() }]),
      },
    });
    const service = new VhcService(prisma as never, makeEmail() as never);
    await service.respondToItem('item-1', { approved: true });

    expect(prisma.jobCardPartRequirement.createMany).toHaveBeenCalledWith({
      data: [{ dealerId: 'dealer-1', jobCardId: 'new-job-1', partId: 'part-1', description: 'Brake pads', quantity: 2 }],
    });
  });

  it('does not create a job card when the customer declines the item', async () => {
    const prisma = makeRespondPrisma();
    const service = new VhcService(prisma as never, makeEmail() as never);
    await service.respondToItem('item-1', { approved: false });
    expect(prisma.jobCard.create).not.toHaveBeenCalled();
  });

  it('closes the inspection once every item has been responded to', async () => {
    const prisma = makeRespondPrisma({ vhcItem: { ...makeRespondPrisma().vhcItem, findMany: jest.fn().mockResolvedValue([{ respondedAt: new Date() }, { respondedAt: new Date() }]) } });
    const service = new VhcService(prisma as never, makeEmail() as never);
    await service.respondToItem('item-1', { approved: false });
    expect(prisma.vhcInspection.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inspection-1' }, data: expect.objectContaining({ status: 'CLOSED' }) }),
    );
  });

  it('leaves the inspection open while other items are still awaiting a response', async () => {
    const prisma = makeRespondPrisma({
      vhcItem: { ...makeRespondPrisma().vhcItem, findMany: jest.fn().mockResolvedValue([{ respondedAt: new Date() }, { respondedAt: null }]) },
    });
    const service = new VhcService(prisma as never, makeEmail() as never);
    await service.respondToItem('item-1', { approved: false });
    expect(prisma.vhcInspection.update).not.toHaveBeenCalled();
  });
});

describe('VhcService.completeInspection', () => {
  it('refuses to sign off an inspection with no items', async () => {
    const prisma = { vhcInspection: { findFirst: jest.fn().mockResolvedValue({ id: 'inspection-1', items: [] }) } };
    const service = new VhcService(prisma as never, makeEmail() as never);
    await expect(service.completeInspection('dealer-1', 'inspection-1', 'tech-1')).rejects.toThrow(BadRequestException);
  });

  it('signs off an inspection that has items', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'inspection-1', status: 'COMPLETE' });
    const prisma = {
      vhcInspection: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inspection-1', items: [{ id: 'item-1' }] }),
        update,
      },
    };
    const service = new VhcService(prisma as never, makeEmail() as never);
    await service.completeInspection('dealer-1', 'inspection-1', 'tech-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETE', completedById: 'tech-1' }) }),
    );
  });
});

describe('VhcService.sendReport', () => {
  it('refuses to send a report before a technician has signed off the inspection', async () => {
    const prisma = {
      vhcInspection: { findFirst: jest.fn().mockResolvedValue({ id: 'inspection-1', completedAt: null }) },
    };
    const service = new VhcService(prisma as never, makeEmail() as never);
    await expect(service.sendReport('dealer-1', 'inspection-1', 'jamie@example.com')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('sends the report once the inspection has been signed off', async () => {
    const email = makeEmail();
    const prisma = {
      vhcInspection: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inspection-1', completedAt: new Date(), vehicleReg: 'AB12CDE' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new VhcService(prisma as never, email as never);
    await service.sendReport('dealer-1', 'inspection-1', 'jamie@example.com');
    expect(email.send).toHaveBeenCalled();
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

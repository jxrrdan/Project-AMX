import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VhcItemResponseStatus, VhcRating } from '@project-amx/shared';
import { VhcService } from './vhc.service';

function makeEmail() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

function makeNotifications() {
  return { create: jest.fn().mockResolvedValue({}) };
}

function makeService(prisma: Record<string, unknown>, email = makeEmail(), notifications = makeNotifications()) {
  return new VhcService(prisma as never, email as never, notifications as never);
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
    const service = makeService(prisma);
    await expect(
      service.addItem('dealer-1', 'other-dealer-inspection', { rating: VhcRating.GREEN, label: 'Wipers' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.vhcItem.create).not.toHaveBeenCalled();
  });

  it('rejects an Amber item with no photo', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await expect(
      service.addItem('dealer-1', 'inspection-1', { rating: VhcRating.AMBER, label: 'Brake pads', photoUrls: [] } as never),
    ).rejects.toThrow('A photo is required for Amber/Red items');
    expect(prisma.vhcItem.create).not.toHaveBeenCalled();
  });

  it('rejects a Red item with an undefined photoUrls field', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await expect(
      service.addItem('dealer-1', 'inspection-1', { rating: VhcRating.RED, label: 'Tyres' } as never),
    ).rejects.toThrow('A photo is required for Amber/Red items');
  });

  it('allows a Green item with no photo', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await service.addItem('dealer-1', 'inspection-1', { rating: VhcRating.GREEN, label: 'Wipers' } as never);
    expect(prisma.vhcItem.create).toHaveBeenCalled();
  });

  it('allows an Amber item once at least one photo is attached', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
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
    const service = makeService(prisma);
    await expect(service.addItemPart('dealer-1', 'other-dealer-item', { partId: 'part-1' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('addItemPart refuses a part outside the caller\'s dealer', async () => {
    const prisma = makePrisma({
      vhcItem: { findFirst: jest.fn().mockResolvedValue({ id: 'item-1' }) },
      part: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const service = makeService(prisma);
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
    const service = makeService(prisma);

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
    const service = makeService(prisma);

    const item = await service.addItem('dealer-1', 'inspection-1', {
      rating: VhcRating.GREEN,
      label: 'Wipers',
    } as never);

    // 30 min @ £100/hr = £50 labour; no linked part -> falls back to the typed £25 estimate; total £75.
    expect(item).toEqual(expect.objectContaining({ quotedLabourCost: 50, quotedPartsCost: 25, quotedTotal: 75 }));
  });

  it('removeItemPart refuses a link outside the caller\'s dealer', async () => {
    const prisma = makePrisma({ vhcItemPart: { findFirst: jest.fn().mockResolvedValue(null) } });
    const service = makeService(prisma);
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
        findMany: jest.fn().mockResolvedValue([{ response: VhcItemResponseStatus.DECLINED }]),
      },
      jobCard: { create: jest.fn().mockResolvedValue({ id: 'new-job-1' }) },
      jobCardPartRequirement: { createMany: jest.fn().mockResolvedValue({}) },
      vhcInspection: { update: jest.fn().mockResolvedValue({}) },
      ...overrides,
    };
  }

  it('creates a follow-up job card linked back to the source item, billed to the original customer, on approval', async () => {
    const prisma = makeRespondPrisma({
      vhcItem: {
        ...makeRespondPrisma().vhcItem,
        findMany: jest.fn().mockResolvedValue([{ response: VhcItemResponseStatus.APPROVED }]),
      },
    });
    const service = makeService(prisma);
    await service.respondToItem('item-1', { response: VhcItemResponseStatus.APPROVED });

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
        findMany: jest.fn().mockResolvedValue([{ response: VhcItemResponseStatus.APPROVED }]),
      },
    });
    const service = makeService(prisma);
    await service.respondToItem('item-1', { response: VhcItemResponseStatus.APPROVED });

    expect(prisma.jobCardPartRequirement.createMany).toHaveBeenCalledWith({
      data: [{ dealerId: 'dealer-1', jobCardId: 'new-job-1', partId: 'part-1', description: 'Brake pads', quantity: 2 }],
    });
  });

  it('does not create a job card when the customer declines the item', async () => {
    const prisma = makeRespondPrisma();
    const service = makeService(prisma);
    await service.respondToItem('item-1', { response: VhcItemResponseStatus.DECLINED });
    expect(prisma.jobCard.create).not.toHaveBeenCalled();
  });

  it('does not create a job card when the customer defers the item', async () => {
    const prisma = makeRespondPrisma({
      vhcItem: {
        ...makeRespondPrisma().vhcItem,
        findMany: jest.fn().mockResolvedValue([{ response: VhcItemResponseStatus.DEFERRED }]),
      },
    });
    const service = makeService(prisma);
    await service.respondToItem('item-1', { response: VhcItemResponseStatus.DEFERRED });
    expect(prisma.jobCard.create).not.toHaveBeenCalled();
  });

  it('closes the inspection once every item has been resolved (approved/declined/deferred)', async () => {
    const prisma = makeRespondPrisma({
      vhcItem: {
        ...makeRespondPrisma().vhcItem,
        findMany: jest
          .fn()
          .mockResolvedValue([{ response: VhcItemResponseStatus.DECLINED }, { response: VhcItemResponseStatus.DEFERRED }]),
      },
    });
    const service = makeService(prisma);
    await service.respondToItem('item-1', { response: VhcItemResponseStatus.DECLINED });
    expect(prisma.vhcInspection.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inspection-1' }, data: expect.objectContaining({ status: 'CLOSED' }) }),
    );
  });

  it('leaves the inspection open while other items are still pending', async () => {
    const prisma = makeRespondPrisma({
      vhcItem: {
        ...makeRespondPrisma().vhcItem,
        findMany: jest
          .fn()
          .mockResolvedValue([{ response: VhcItemResponseStatus.DECLINED }, { response: VhcItemResponseStatus.PENDING }]),
      },
    });
    const service = makeService(prisma);
    await service.respondToItem('item-1', { response: VhcItemResponseStatus.DECLINED });
    expect(prisma.vhcInspection.update).not.toHaveBeenCalled();
  });
});

describe('VhcService.respondToItemAsAdvisor', () => {
  it('refuses an item outside the caller\'s dealer', async () => {
    const prisma = { vhcItem: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = makeService(prisma);
    await expect(
      service.respondToItemAsAdvisor('dealer-1', 'other-dealer-item', { response: VhcItemResponseStatus.DECLINED }),
    ).rejects.toThrow(NotFoundException);
  });

  it('logs the customer\'s verbal decision the same way the public endpoint would', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'item-1',
      inspectionId: 'inspection-1',
      label: 'Brake pads',
      parts: [],
      inspection: { dealerId: 'dealer-1', vehicleReg: 'AB12CDE', jobCard: { customerName: 'Jamie Smith' } },
    });
    const prisma = {
      vhcItem: {
        findFirst: jest.fn().mockResolvedValue({ id: 'item-1' }),
        update,
        findMany: jest.fn().mockResolvedValue([{ response: VhcItemResponseStatus.DECLINED }]),
      },
      vhcInspection: { update: jest.fn().mockResolvedValue({}) },
    };
    const service = makeService(prisma);
    await service.respondToItemAsAdvisor('dealer-1', 'item-1', { response: VhcItemResponseStatus.DECLINED });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ response: 'DECLINED' }) }));
  });
});

describe('VhcService.removeItem', () => {
  it('refuses an item outside the caller\'s dealer', async () => {
    const prisma = { vhcItem: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = makeService(prisma);
    await expect(service.removeItem('dealer-1', 'other-dealer-item')).rejects.toThrow(NotFoundException);
  });

  it('refuses to delete an item that has already been responded to', async () => {
    const prisma = {
      vhcItem: {
        findFirst: jest.fn().mockResolvedValue({ id: 'item-1', inspectionId: 'inspection-1', response: VhcItemResponseStatus.APPROVED }),
        delete: jest.fn(),
      },
    };
    const service = makeService(prisma);
    await expect(service.removeItem('dealer-1', 'item-1')).rejects.toThrow(BadRequestException);
    expect(prisma.vhcItem.delete).not.toHaveBeenCalled();
  });

  it('deletes a pending item', async () => {
    const del = jest.fn().mockResolvedValue({});
    const prisma = {
      vhcItem: {
        findFirst: jest.fn().mockResolvedValue({ id: 'item-1', inspectionId: 'inspection-1', response: VhcItemResponseStatus.PENDING }),
        delete: del,
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = makeService(prisma);
    const result = await service.removeItem('dealer-1', 'item-1');
    expect(del).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    expect(result).toEqual({ success: true });
  });
});

describe('VhcService.recordInspection', () => {
  it('refuses to sign off an inspection with no items', async () => {
    const prisma = {
      vhcInspection: { findFirst: jest.fn().mockResolvedValue({ id: 'inspection-1', items: [], jobCard: {} }) },
    };
    const service = makeService(prisma);
    await expect(service.recordInspection('dealer-1', 'inspection-1', 'tech-1', {})).rejects.toThrow(BadRequestException);
  });

  it('notifies the job card\'s assigned service advisor once recorded', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'inspection-1', status: 'RECORDED' });
    const prisma = {
      vhcInspection: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inspection-1',
          vehicleReg: 'AB12CDE',
          items: [{ id: 'item-1' }],
          jobCard: { serviceAdvisorId: 'advisor-1' },
        }),
        update,
      },
    };
    const notifications = makeNotifications();
    const service = makeService(prisma, makeEmail(), notifications);
    await service.recordInspection('dealer-1', 'inspection-1', 'tech-1', { videoUrl: 'https://example.com/video.mp4' });

    expect(notifications.create).toHaveBeenCalledWith(
      'dealer-1',
      'advisor-1',
      'VHC_READY_FOR_REVIEW',
      expect.any(String),
      expect.any(String),
      'EMAIL',
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RECORDED',
          recordedById: 'tech-1',
          videoUrl: 'https://example.com/video.mp4',
          notifiedServiceAdvisorAt: expect.any(Date),
        }),
      }),
    );
  });

  it('does not notify or fail when no service advisor is assigned to the job', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'inspection-1', status: 'RECORDED' });
    const prisma = {
      vhcInspection: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inspection-1',
          vehicleReg: 'AB12CDE',
          items: [{ id: 'item-1' }],
          jobCard: { serviceAdvisorId: null },
        }),
        update,
      },
    };
    const notifications = makeNotifications();
    const service = makeService(prisma, makeEmail(), notifications);
    await service.recordInspection('dealer-1', 'inspection-1', 'tech-1', {});

    expect(notifications.create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ notifiedServiceAdvisorAt: null }) }));
  });
});

describe('VhcService.sendReport', () => {
  it('refuses to send a report before a technician has recorded the inspection', async () => {
    const prisma = {
      vhcInspection: { findFirst: jest.fn().mockResolvedValue({ id: 'inspection-1', recordedAt: null }) },
    };
    const service = makeService(prisma);
    await expect(service.sendReport('dealer-1', 'inspection-1', 'jamie@example.com')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('sends the report once the inspection has been recorded, and marks contact by email', async () => {
    const email = makeEmail();
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      vhcInspection: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inspection-1', recordedAt: new Date(), vehicleReg: 'AB12CDE' }),
        update,
      },
    };
    const service = makeService(prisma, email);
    await service.sendReport('dealer-1', 'inspection-1', 'jamie@example.com');
    expect(email.send).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ contactMethod: 'EMAIL', status: 'SENT' }) }),
    );
  });
});

describe('VhcService.logPhoneContact', () => {
  it('refuses to log a call before a technician has recorded the inspection', async () => {
    const prisma = {
      vhcInspection: { findFirst: jest.fn().mockResolvedValue({ id: 'inspection-1', recordedAt: null }) },
    };
    const service = makeService(prisma);
    await expect(service.logPhoneContact('dealer-1', 'inspection-1', {})).rejects.toThrow(BadRequestException);
  });

  it('logs the phone call once the inspection has been recorded', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      vhcInspection: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inspection-1', recordedAt: new Date() }),
        update,
      },
    };
    const service = makeService(prisma);
    await service.logPhoneContact('dealer-1', 'inspection-1', { notes: 'Approved the brake pads, declined the rest' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactMethod: 'PHONE',
          contactNotes: 'Approved the brake pads, declined the rest',
          status: 'CONTACTED',
        }),
      }),
    );
  });
});

describe('VhcService.conversionRate', () => {
  it('computes the share of presented Amber/Red items the customer approved', async () => {
    const prisma = {
      vhcItem: {
        findMany: jest.fn().mockResolvedValue([
          { response: VhcItemResponseStatus.APPROVED },
          { response: VhcItemResponseStatus.DECLINED },
          { response: VhcItemResponseStatus.PENDING },
          { response: VhcItemResponseStatus.APPROVED },
        ]),
      },
    };
    const service = makeService(prisma);
    const result = await service.conversionRate('dealer-1');
    // Only responded items (3) count toward the rate; 2 of those were approved.
    expect(result).toEqual({ presented: 4, approved: 2, conversionRate: 2 / 3 });
  });

  it('reports a zero rate rather than dividing by zero when nothing has been responded to yet', async () => {
    const prisma = { vhcItem: { findMany: jest.fn().mockResolvedValue([{ response: VhcItemResponseStatus.PENDING }]) } };
    const service = makeService(prisma);
    const result = await service.conversionRate('dealer-1');
    expect(result.conversionRate).toBe(0);
  });
});

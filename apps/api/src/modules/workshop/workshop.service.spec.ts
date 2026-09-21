import { NotFoundException } from '@nestjs/common';
import { WorkshopService } from './workshop.service';

function makeService(prisma: Record<string, unknown>) {
  return new WorkshopService(prisma as never, { emitJobCardChanged: jest.fn() } as never, { record: jest.fn() } as never);
}

describe('WorkshopService.getPublicBoard', () => {
  it('throws when no dealer matches the given board token (e.g. a stale/revoked token, or a plain dealerId)', async () => {
    const findMany = jest.fn();
    const prisma = {
      dealer: { findUnique: jest.fn().mockResolvedValue(null) },
      jobCard: { findMany },
    };
    const service = makeService(prisma);
    await expect(service.getPublicBoard('not-a-real-token')).rejects.toThrow(NotFoundException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('resolves the dealer from the token and returns only that dealer\'s job cards', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'job-1' }]);
    const prisma = {
      dealer: { findUnique: jest.fn().mockResolvedValue({ id: 'dealer-1', workshopBoardToken: 'real-token' }) },
      jobCard: { findMany },
    };
    const service = makeService(prisma);
    const result = await service.getPublicBoard('real-token');
    expect(result).toEqual([{ id: 'job-1' }]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ dealerId: 'dealer-1' }) }));
  });
});

describe('WorkshopService.getJobCard', () => {
  it('throws when the job card does not belong to this dealer', async () => {
    const prisma = { jobCard: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = makeService(prisma);
    await expect(service.getJobCard('dealer-1', 'other-dealer-job')).rejects.toThrow(NotFoundException);
  });

  it('returns the job card scoped to this dealer', async () => {
    const jobCard = { id: 'job-1', dealerId: 'dealer-1' };
    const findFirst = jest.fn().mockResolvedValue(jobCard);
    const prisma = { jobCard: { findFirst } };
    const service = makeService(prisma);
    const result = await service.getJobCard('dealer-1', 'job-1');
    expect(result).toEqual(jobCard);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'job-1', dealerId: 'dealer-1' } }));
  });
});

describe('WorkshopService.loadingReport', () => {
  const dealerId = 'dealer-1';

  it('computes utilisationPct from booked job-card hours against configured capacity', async () => {
    const prisma = {
      capacityBlock: {
        findMany: jest.fn().mockResolvedValue([{ bayId: 'bay-1', date: new Date('2026-10-01'), availableMinutes: 480 }]),
      },
      jobCard: {
        findMany: jest.fn().mockResolvedValue([
          { bayId: 'bay-1', scheduledStart: new Date('2026-10-01T09:00:00Z'), estimatedHours: 2 },
          { bayId: 'bay-1', scheduledStart: new Date('2026-10-01T13:00:00Z'), estimatedHours: 2 },
        ]),
      },
      bay: { findMany: jest.fn().mockResolvedValue([{ id: 'bay-1', name: 'Bay 1' }]) },
    };
    const service = makeService(prisma);

    const rows = await service.loadingReport(dealerId, '2026-10-01', '2026-10-01');

    expect(rows).toEqual([
      { bayId: 'bay-1', bayName: 'Bay 1', date: '2026-10-01', capacityMinutes: 480, bookedMinutes: 240, utilisationPct: 50 },
    ]);
  });

  it('reports null utilisation for a bay/day with booked jobs but no configured capacity', async () => {
    const prisma = {
      capacityBlock: { findMany: jest.fn().mockResolvedValue([]) },
      jobCard: {
        findMany: jest.fn().mockResolvedValue([{ bayId: 'bay-1', scheduledStart: new Date('2026-10-01T09:00:00Z'), estimatedHours: 1 }]),
      },
      bay: { findMany: jest.fn().mockResolvedValue([{ id: 'bay-1', name: 'Bay 1' }]) },
    };
    const service = makeService(prisma);

    const rows = await service.loadingReport(dealerId, '2026-10-01', '2026-10-01');

    expect(rows).toEqual([{ bayId: 'bay-1', bayName: 'Bay 1', date: '2026-10-01', capacityMinutes: 0, bookedMinutes: 60, utilisationPct: null }]);
  });
});

describe('WorkshopService part requirements', () => {
  const dealerId = 'dealer-1';

  it('addPartRequirement throws when the job card does not belong to this dealer', async () => {
    const create = jest.fn();
    const prisma = { jobCard: { findFirst: jest.fn().mockResolvedValue(null) }, jobCardPartRequirement: { create } };
    const service = makeService(prisma);
    await expect(service.addPartRequirement(dealerId, 'other-dealer-job', { description: 'Brake disc' })).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('addPartRequirement throws when a supplied partId does not belong to this dealer', async () => {
    const create = jest.fn();
    const prisma = {
      jobCard: { findFirst: jest.fn().mockResolvedValue({ id: 'job-1' }) },
      part: { findFirst: jest.fn().mockResolvedValue(null) },
      jobCardPartRequirement: { create },
    };
    const service = makeService(prisma);
    await expect(
      service.addPartRequirement(dealerId, 'job-1', { partId: 'other-dealer-part', description: 'Brake disc' }),
    ).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('removePartRequirement refuses a requirement belonging to another dealer', async () => {
    const del = jest.fn();
    const prisma = { jobCardPartRequirement: { findFirst: jest.fn().mockResolvedValue(null), delete: del } };
    const service = makeService(prisma);
    await expect(service.removePartRequirement(dealerId, 'other-dealer-requirement')).rejects.toThrow(NotFoundException);
    expect(del).not.toHaveBeenCalled();
  });
});

describe('WorkshopService operation lines (per-line clocking)', () => {
  const dealerId = 'dealer-1';

  it('addOperationLine refuses to add a line to another dealer\'s job card', async () => {
    const create = jest.fn();
    const prisma = { jobCard: { findFirst: jest.fn().mockResolvedValue(null) }, jobCardOperationLine: { create } };
    const service = makeService(prisma);
    await expect(service.addOperationLine(dealerId, 'other-dealer-job', { description: 'Front brake pads' })).rejects.toThrow(
      NotFoundException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('addOperationLine creates a line against the job card', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'line-1' });
    const prisma = { jobCard: { findFirst: jest.fn().mockResolvedValue({ id: 'job-1' }) }, jobCardOperationLine: { create } };
    const service = makeService(prisma);
    await service.addOperationLine(dealerId, 'job-1', { description: 'Front brake pads', estimatedMinutes: 45 });
    expect(create).toHaveBeenCalledWith({ data: { jobCardId: 'job-1', description: 'Front brake pads', estimatedMinutes: 45 } });
  });

  it('clockOnLine refuses to clock on a line belonging to another dealer', async () => {
    const prisma = {
      jobCardOperationLine: { findFirst: jest.fn().mockResolvedValue(null) },
      jobCardLineClockEntry: { create: jest.fn() },
    };
    const service = makeService(prisma);
    await expect(service.clockOnLine(dealerId, 'other-dealer-line', 'tech-1')).rejects.toThrow(NotFoundException);
    expect(prisma.jobCardLineClockEntry.create).not.toHaveBeenCalled();
  });

  it('clockOnLine creates a clock entry and marks the job card in progress', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'job-1', status: 'IN_PROGRESS' });
    const prisma = {
      jobCardOperationLine: { findFirst: jest.fn().mockResolvedValue({ id: 'line-1', jobCardId: 'job-1' }) },
      jobCardLineClockEntry: { create: jest.fn().mockResolvedValue({}) },
      jobCard: { update },
    };
    const service = makeService(prisma);
    await service.clockOnLine(dealerId, 'line-1', 'tech-1');
    expect(prisma.jobCardLineClockEntry.create).toHaveBeenCalledWith({
      data: { lineId: 'line-1', technicianId: 'tech-1', clockOn: expect.any(Date) },
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'job-1' }, data: { status: 'IN_PROGRESS' } }));
  });

  it('clockOffLine throws when there is no open clocking for that technician on the line', async () => {
    const prisma = {
      jobCardOperationLine: { findFirst: jest.fn().mockResolvedValue({ id: 'line-1', jobCardId: 'job-1' }) },
      jobCardLineClockEntry: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = makeService(prisma);
    await expect(service.clockOffLine(dealerId, 'line-1', 'tech-1')).rejects.toThrow(NotFoundException);
  });

  it('clockOffLine closes the most recent open clocking entry for that technician', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'clock-1', clockOff: new Date() });
    const prisma = {
      jobCardOperationLine: { findFirst: jest.fn().mockResolvedValue({ id: 'line-1', jobCardId: 'job-1' }) },
      jobCardLineClockEntry: { findFirst: jest.fn().mockResolvedValue({ id: 'clock-1', clockOff: null }), update },
      jobCard: { findUnique: jest.fn().mockResolvedValue({ id: 'job-1' }) },
    };
    const service = makeService(prisma);
    await service.clockOffLine(dealerId, 'line-1', 'tech-1');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'clock-1' }, data: { clockOff: expect.any(Date) } }));
  });
});

describe('WorkshopService.upcomingPartsShortfalls', () => {
  const dealerId = 'dealer-1';

  it('flags a part where aggregated requirements across upcoming jobs exceed stock on hand', async () => {
    const prisma = {
      jobCardPartRequirement: {
        findMany: jest.fn().mockResolvedValue([
          {
            partId: 'part-1',
            description: 'Brake disc',
            quantity: 3,
            part: { partNumber: 'BD-1', description: 'Brake disc', quantityOnHand: 4 },
            jobCard: { id: 'job-1', customerName: 'Jamie', vehicleReg: 'AB12CDE', scheduledStart: new Date() },
          },
          {
            partId: 'part-1',
            description: 'Brake disc',
            quantity: 3,
            part: { partNumber: 'BD-1', description: 'Brake disc', quantityOnHand: 4 },
            jobCard: { id: 'job-2', customerName: 'Sam', vehicleReg: 'CD34EFG', scheduledStart: new Date() },
          },
        ]),
      },
    };
    const service = makeService(prisma);

    const result = await service.upcomingPartsShortfalls(dealerId);

    expect(result.shortfalls).toEqual([
      { partId: 'part-1', partNumber: 'BD-1', description: 'Brake disc', quantityOnHand: 4, quantityRequired: 6, shortfall: 2, jobCardCount: 2 },
    ]);
    expect(result.unmatched).toEqual([]);
  });

  it('does not flag a part when stock on hand covers total upcoming requirements', async () => {
    const prisma = {
      jobCardPartRequirement: {
        findMany: jest.fn().mockResolvedValue([
          {
            partId: 'part-1',
            description: 'Oil filter',
            quantity: 1,
            part: { partNumber: 'OF-1', description: 'Oil filter', quantityOnHand: 10 },
            jobCard: { id: 'job-1', customerName: 'Jamie', vehicleReg: 'AB12CDE', scheduledStart: new Date() },
          },
        ]),
      },
    };
    const service = makeService(prisma);

    const result = await service.upcomingPartsShortfalls(dealerId);

    expect(result.shortfalls).toEqual([]);
  });

  it('reports a requirement with no matched part as unmatched, not a shortfall', async () => {
    const prisma = {
      jobCardPartRequirement: {
        findMany: jest.fn().mockResolvedValue([
          {
            partId: null,
            description: 'Non-stocked bespoke bracket',
            quantity: 1,
            part: null,
            jobCard: { id: 'job-1', customerName: 'Jamie', vehicleReg: 'AB12CDE', scheduledStart: new Date() },
          },
        ]),
      },
    };
    const service = makeService(prisma);

    const result = await service.upcomingPartsShortfalls(dealerId);

    expect(result.shortfalls).toEqual([]);
    expect(result.unmatched).toEqual([
      { description: 'Non-stocked bespoke bracket', quantity: 1, jobCardId: 'job-1', customerName: 'Jamie' },
    ]);
  });
});

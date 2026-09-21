import { NotFoundException } from '@nestjs/common';
import { JobCategory, TechnicianAvailabilityStatus } from '@project-amx/shared';
import { TechniciansService } from './technicians.service';

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'tech-1', dealerId: 'dealer-1' }), findMany: jest.fn().mockResolvedValue([]) },
    technicianSkill: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    technicianAvailability: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
    },
    jobCard: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    ...overrides,
  };
}

describe('TechniciansService.setSkills', () => {
  it('refuses to set skills for a technician outside the caller\'s dealer', async () => {
    const prisma = makePrisma({ user: { findFirst: jest.fn().mockResolvedValue(null) } });
    const service = new TechniciansService(prisma as never);
    await expect(service.setSkills('dealer-1', 'tech-x', { categories: [JobCategory.MECHANICAL] })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('replaces the full skill set in a transaction', async () => {
    const prisma = makePrisma();
    const service = new TechniciansService(prisma as never);
    await service.setSkills('dealer-1', 'tech-1', { categories: [JobCategory.MECHANICAL, JobCategory.EV, JobCategory.MECHANICAL] });
    expect(prisma.technicianSkill.deleteMany).toHaveBeenCalledWith({ where: { userId: 'tech-1' } });
    expect(prisma.technicianSkill.createMany).toHaveBeenCalledWith({
      data: [
        { dealerId: 'dealer-1', userId: 'tech-1', category: JobCategory.MECHANICAL },
        { dealerId: 'dealer-1', userId: 'tech-1', category: JobCategory.EV },
      ],
    });
  });
});

describe('TechniciansService.setAvailability', () => {
  it('refuses a technician outside the caller\'s dealer', async () => {
    const prisma = makePrisma({ user: { findFirst: jest.fn().mockResolvedValue(null) } });
    const service = new TechniciansService(prisma as never);
    await expect(
      service.setAvailability('dealer-1', { userId: 'tech-x', date: '2026-09-22', status: TechnicianAvailabilityStatus.LEAVE }),
    ).rejects.toThrow(NotFoundException);
  });

  it('defaults to a standard 480-minute day when none is given', async () => {
    const prisma = makePrisma();
    const service = new TechniciansService(prisma as never);
    await service.setAvailability('dealer-1', { userId: 'tech-1', date: '2026-09-22', status: TechnicianAvailabilityStatus.AVAILABLE });
    expect(prisma.technicianAvailability.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ availableMinutes: 480 }) }),
    );
  });
});

describe('TechniciansService.capacityReport', () => {
  it('sums skilled + available technician minutes as capacity, against booked job-card hours, per category per day', async () => {
    const prisma = makePrisma({
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          { id: 'tech-1', technicianSkills: [{ category: JobCategory.MECHANICAL }] },
          { id: 'tech-2', technicianSkills: [{ category: JobCategory.EV }] },
        ]),
      },
      technicianAvailability: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'tech-2', date: new Date('2026-09-22'), status: TechnicianAvailabilityStatus.SICKNESS, availableMinutes: 480 },
        ]),
        upsert: jest.fn(),
      },
      jobCard: {
        findMany: jest.fn().mockResolvedValue([
          { category: JobCategory.MECHANICAL, scheduledStart: new Date('2026-09-22'), estimatedHours: 2 },
          { category: JobCategory.EV, scheduledStart: new Date('2026-09-22'), estimatedHours: 3 },
        ]),
      },
    });
    const service = new TechniciansService(prisma as never);
    const rows = await service.capacityReport('dealer-1', '2026-09-22', '2026-09-22');

    const mechanical = rows.find((r) => r.category === JobCategory.MECHANICAL);
    const ev = rows.find((r) => r.category === JobCategory.EV);

    // tech-1 is unmarked -> defaults to AVAILABLE at 480 minutes.
    expect(mechanical).toEqual({ category: JobCategory.MECHANICAL, date: '2026-09-22', capacityMinutes: 480, bookedMinutes: 120, utilisationPct: 25 });
    // tech-2 is explicitly SICKNESS -> contributes zero capacity even though booked EV work exists.
    expect(ev).toEqual({ category: JobCategory.EV, date: '2026-09-22', capacityMinutes: 0, bookedMinutes: 180, utilisationPct: null });
  });

  it('rejects an inverted date range', async () => {
    const prisma = makePrisma();
    const service = new TechniciansService(prisma as never);
    await expect(service.capacityReport('dealer-1', '2026-09-25', '2026-09-20')).rejects.toThrow(
      '"from" must not be after "to"',
    );
  });
});

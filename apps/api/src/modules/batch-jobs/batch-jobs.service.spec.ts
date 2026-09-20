import { BadRequestException } from '@nestjs/common';
import { BatchJobName, BatchJobStatus, LeadStage, SystemRole } from '@project-amx/shared';
import { BatchJobsService } from './batch-jobs.service';

function makeNotifications() {
  return { create: jest.fn(), createMany: jest.fn() };
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  const run = { id: 'run-1' };
  return {
    batchJobRun: {
      create: jest.fn().mockResolvedValue(run),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'run-1', ...data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    lead: { findMany: jest.fn().mockResolvedValue([]) },
    part: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    courtesyVehicle: { findMany: jest.fn().mockResolvedValue([]) },
    dealer: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

describe('BatchJobsService.runNow', () => {
  const dealerId = 'dealer-1';

  it('rejects an unknown job name', async () => {
    const service = new BatchJobsService(makePrisma() as never, makeNotifications() as never);
    await expect(service.runNow(dealerId, 'NOT_A_JOB' as BatchJobName)).rejects.toThrow(BadRequestException);
  });

  it('records a SUCCESS run with a summary when the job completes', async () => {
    const prisma = makePrisma({ lead: { findMany: jest.fn().mockResolvedValue([]) } });
    const service = new BatchJobsService(prisma as never, makeNotifications() as never);

    const result = await service.runNow(dealerId, BatchJobName.STALE_LEAD_ESCALATION);

    expect(prisma.batchJobRun.create).toHaveBeenCalledWith({
      data: { dealerId, jobName: BatchJobName.STALE_LEAD_ESCALATION, status: BatchJobStatus.RUNNING },
    });
    expect(result).toMatchObject({ status: BatchJobStatus.SUCCESS, summary: '0 stale lead(s) flagged' });
  });

  it('notifies the assigned salesperson for each stale lead', async () => {
    const notifications = makeNotifications();
    const prisma = makePrisma({
      lead: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'lead-1',
            stage: LeadStage.CONTACTED,
            assignedSalespersonId: 'user-1',
            contact: { firstName: 'Jamie', lastName: 'Smith' },
          },
        ]),
      },
    });
    const service = new BatchJobsService(prisma as never, notifications as never);

    const result = await service.runNow(dealerId, BatchJobName.STALE_LEAD_ESCALATION);

    expect(notifications.create).toHaveBeenCalledWith(
      dealerId,
      'user-1',
      'STALE_LEAD',
      'Stale lead needs attention',
      expect.stringContaining('Jamie Smith'),
    );
    expect(result).toMatchObject({ summary: '1 stale lead(s) flagged' });
  });

  it('notifies parts managers about parts at or below their reorder level', async () => {
    const notifications = makeNotifications();
    const prisma = makePrisma({
      part: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ partNumber: 'P1', quantityOnHand: 2, reorderLevel: 5 }]),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'pm-1' }]) },
    });
    const service = new BatchJobsService(prisma as never, notifications as never);

    const result = await service.runNow(dealerId, BatchJobName.PARTS_REORDER_ALERT);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { dealerId, active: true, roles: { some: { role: { systemRole: SystemRole.PARTS_MANAGER } } } },
    });
    expect(notifications.createMany).toHaveBeenCalledWith(
      dealerId,
      ['pm-1'],
      'PARTS_REORDER',
      'Parts below reorder level',
      expect.stringContaining('P1'),
    );
    expect(result).toMatchObject({ summary: '1 part(s) at/below reorder level; notified 1 parts manager(s)' });
  });

  it('records an ERROR run when the job throws', async () => {
    const prisma = makePrisma({
      lead: { findMany: jest.fn().mockRejectedValue(new Error('db down')) },
    });
    const service = new BatchJobsService(prisma as never, makeNotifications() as never);

    const result = await service.runNow(dealerId, BatchJobName.STALE_LEAD_ESCALATION);

    expect(result).toMatchObject({ status: BatchJobStatus.ERROR, errorMessage: 'db down' });
  });
});

describe('BatchJobsService.listRuns', () => {
  it('scopes run history to the given dealer', async () => {
    const prisma = makePrisma();
    const service = new BatchJobsService(prisma as never, makeNotifications() as never);

    await service.listRuns('dealer-1');

    expect(prisma.batchJobRun.findMany).toHaveBeenCalledWith({
      where: { dealerId: 'dealer-1' },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  });
});

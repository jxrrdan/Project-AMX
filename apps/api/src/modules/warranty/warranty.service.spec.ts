import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WarrantyClaimStatus } from '@project-amx/shared';
import { WarrantyService } from './warranty.service';

function makeLine(overrides: Record<string, unknown> = {}) {
  return {
    id: 'line-1',
    approvedAt: new Date(),
    labourWriteUp: 'Replaced the sensor',
    cause: 'Sensor failure',
    correction: 'Replaced sensor',
    complaint: 'Warning light on',
    ...overrides,
  };
}

function makePrisma(claim: Record<string, unknown> | null) {
  return {
    warrantyClaim: {
      findFirst: jest.fn().mockResolvedValue(claim),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'claim-1', ...data })),
    },
  };
}

describe('WarrantyService.create', () => {
  const dealerId = 'dealer-1';

  it('creates a standalone claim when no job card is linked', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'claim-1' });
    const prisma = {
      warrantyClaim: { create },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const service = new WarrantyService(prisma as never);
    await service.create(dealerId, { vehicleId: 'veh-1', customerName: 'Jamie', faultDescription: 'Rattle' });
    expect(create).toHaveBeenCalled();
  });

  it('refuses to link a job card that belongs to another dealer', async () => {
    const prisma = {
      jobCard: { findFirst: jest.fn().mockResolvedValue(null) },
      warrantyClaim: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    const service = new WarrantyService(prisma as never);
    await expect(
      service.create(dealerId, { vehicleId: 'veh-1', jobCardId: 'other-dealer-job', customerName: 'Jamie', faultDescription: 'Rattle' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.warrantyClaim.create).not.toHaveBeenCalled();
  });

  it('auto-routes a linked job card\'s billing to WARRANTY so it is never invoiced to the customer', async () => {
    const prisma = {
      jobCard: { findFirst: jest.fn().mockResolvedValue({ id: 'job-1', dealerId }), update: jest.fn() },
      warrantyClaim: { create: jest.fn().mockResolvedValue({ id: 'claim-1' }) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const service = new WarrantyService(prisma as never);
    await service.create(dealerId, { vehicleId: 'veh-1', jobCardId: 'job-1', customerName: 'Jamie', faultDescription: 'Rattle' });
    expect(prisma.jobCard.update).toHaveBeenCalledWith({ where: { id: 'job-1' }, data: { billingType: 'WARRANTY' } });
  });
});

describe('WarrantyService.updateStatus', () => {
  const dealerId = 'dealer-1';

  it('throws when the claim does not exist for this dealer', async () => {
    const prisma = makePrisma(null);
    const service = new WarrantyService(prisma as never);
    await expect(
      service.updateStatus(dealerId, 'claim-1', { status: WarrantyClaimStatus.SUBMITTED }),
    ).rejects.toThrow(NotFoundException);
  });

  it('blocks submission while any operation line is unapproved', async () => {
    const prisma = makePrisma({ id: 'claim-1', operationLines: [makeLine({ approvedAt: null })] });
    const service = new WarrantyService(prisma as never);
    await expect(
      service.updateStatus(dealerId, 'claim-1', { status: WarrantyClaimStatus.SUBMITTED }),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks submission when a line is approved but missing any of the mandatory 3Cs', async () => {
    const prisma = makePrisma({ id: 'claim-1', operationLines: [makeLine({ cause: '' })] });
    const service = new WarrantyService(prisma as never);
    await expect(
      service.updateStatus(dealerId, 'claim-1', { status: WarrantyClaimStatus.SUBMITTED }),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks submission when the labour write-up is missing', async () => {
    const prisma = makePrisma({ id: 'claim-1', operationLines: [makeLine({ labourWriteUp: null })] });
    const service = new WarrantyService(prisma as never);
    await expect(
      service.updateStatus(dealerId, 'claim-1', { status: WarrantyClaimStatus.SUBMITTED }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows submission once every line is approved and has a full 3Cs write-up, and records submittedAt', async () => {
    const prisma = makePrisma({ id: 'claim-1', operationLines: [makeLine(), makeLine({ id: 'line-2' })], submittedAt: null });
    const service = new WarrantyService(prisma as never);
    const result = await service.updateStatus(dealerId, 'claim-1', { status: WarrantyClaimStatus.SUBMITTED });
    expect(result.status).toBe(WarrantyClaimStatus.SUBMITTED);
    expect(result.submittedAt).toBeInstanceOf(Date);
  });

  it('does not overwrite submittedAt on a later, unrelated status update', async () => {
    const firstSubmittedAt = new Date('2026-01-01T00:00:00Z');
    const prisma = makePrisma({
      id: 'claim-1',
      submittedAt: firstSubmittedAt,
      operationLines: [makeLine(), makeLine({ id: 'line-2' })],
    });
    const service = new WarrantyService(prisma as never);
    const result = await service.updateStatus(dealerId, 'claim-1', { status: WarrantyClaimStatus.SUBMITTED });
    expect(result.submittedAt).toBeUndefined();
  });

  it('does not gate a non-submission transition on the 3Cs (e.g. moving a draft to rejected)', async () => {
    const prisma = makePrisma({ id: 'claim-1', operationLines: [makeLine({ approvedAt: null, cause: null })] });
    const service = new WarrantyService(prisma as never);
    const result = await service.updateStatus(dealerId, 'claim-1', {
      status: WarrantyClaimStatus.REJECTED,
      rejectionReason: 'Not covered',
    });
    expect(result.status).toBe(WarrantyClaimStatus.REJECTED);
  });
});

describe('WarrantyService.clockOff', () => {
  it('throws when the operation line does not belong to this dealer', async () => {
    const prisma = {
      warrantyOperationLine: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new WarrantyService(prisma as never);
    await expect(service.clockOff('dealer-1', 'line-1', 'tech-1')).rejects.toThrow(NotFoundException);
  });

  it('throws when there is no open clocking for that technician on the line', async () => {
    const prisma = {
      warrantyOperationLine: { findFirst: jest.fn().mockResolvedValue({ id: 'line-1' }) },
      warrantyClockEntry: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new WarrantyService(prisma as never);
    await expect(service.clockOff('dealer-1', 'line-1', 'tech-1')).rejects.toThrow(NotFoundException);
  });

  it('closes the most recent open clocking entry', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'clock-1', clockOff: new Date() });
    const prisma = {
      warrantyOperationLine: { findFirst: jest.fn().mockResolvedValue({ id: 'line-1' }) },
      warrantyClockEntry: {
        findFirst: jest.fn().mockResolvedValue({ id: 'clock-1', clockOff: null }),
        update,
      },
    };
    const service = new WarrantyService(prisma as never);
    await service.clockOff('dealer-1', 'line-1', 'tech-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'clock-1' }, data: { clockOff: expect.any(Date) } }),
    );
  });
});

describe('WarrantyService tenant scoping', () => {
  const dealerId = 'dealer-1';

  it('addOperationLine refuses to add a line to another dealer\'s claim', async () => {
    const prisma = {
      warrantyClaim: { findFirst: jest.fn().mockResolvedValue(null) },
      warrantyOperationLine: { create: jest.fn() },
    };
    const service = new WarrantyService(prisma as never);
    await expect(service.addOperationLine(dealerId, 'other-dealer-claim', {} as never)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.warrantyOperationLine.create).not.toHaveBeenCalled();
  });

  it('updateOperationLine refuses to update a line whose parent claim belongs to another dealer', async () => {
    const prisma = {
      warrantyOperationLine: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    };
    const service = new WarrantyService(prisma as never);
    await expect(service.updateOperationLine(dealerId, 'other-dealer-line', {} as never)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.warrantyOperationLine.update).not.toHaveBeenCalled();
  });

  it('approveLine refuses to approve a line belonging to another dealer', async () => {
    const prisma = {
      warrantyOperationLine: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    };
    const service = new WarrantyService(prisma as never);
    await expect(service.approveLine(dealerId, 'other-dealer-line', 'Supervisor Name')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.warrantyOperationLine.update).not.toHaveBeenCalled();
  });

  it('clockOn refuses to clock on a line belonging to another dealer', async () => {
    const prisma = {
      warrantyOperationLine: { findFirst: jest.fn().mockResolvedValue(null) },
      warrantyClockEntry: { create: jest.fn() },
    };
    const service = new WarrantyService(prisma as never);
    await expect(service.clockOn(dealerId, 'other-dealer-line', 'tech-1')).rejects.toThrow(NotFoundException);
    expect(prisma.warrantyClockEntry.create).not.toHaveBeenCalled();
  });
});

describe('WarrantyService.rejectionRateReport', () => {
  it('computes the rejection rate across all claims', async () => {
    const prisma = {
      warrantyClaim: {
        findMany: jest.fn().mockResolvedValue([
          { status: WarrantyClaimStatus.REJECTED },
          { status: WarrantyClaimStatus.PAID },
          { status: WarrantyClaimStatus.REJECTED },
          { status: WarrantyClaimStatus.SUBMITTED },
        ]),
      },
    };
    const service = new WarrantyService(prisma as never);
    const report = await service.rejectionRateReport('dealer-1');
    expect(report).toEqual({ total: 4, rejected: 2, rejectionRate: 0.5 });
  });

  it('reports a zero rate rather than dividing by zero when there are no claims', async () => {
    const prisma = { warrantyClaim: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new WarrantyService(prisma as never);
    const report = await service.rejectionRateReport('dealer-1');
    expect(report.rejectionRate).toBe(0);
  });
});

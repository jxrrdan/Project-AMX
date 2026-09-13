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

  it('allows submission once every line is approved and has a full 3Cs write-up', async () => {
    const prisma = makePrisma({ id: 'claim-1', operationLines: [makeLine(), makeLine({ id: 'line-2' })] });
    const service = new WarrantyService(prisma as never);
    const result = await service.updateStatus(dealerId, 'claim-1', { status: WarrantyClaimStatus.SUBMITTED });
    expect(result.status).toBe(WarrantyClaimStatus.SUBMITTED);
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
  it('throws when there is no open clocking for that technician on the line', async () => {
    const prisma = {
      warrantyClockEntry: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new WarrantyService(prisma as never);
    await expect(service.clockOff('line-1', 'tech-1')).rejects.toThrow(NotFoundException);
  });

  it('closes the most recent open clocking entry', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'clock-1', clockOff: new Date() });
    const prisma = {
      warrantyClockEntry: {
        findFirst: jest.fn().mockResolvedValue({ id: 'clock-1', clockOff: null }),
        update,
      },
    };
    const service = new WarrantyService(prisma as never);
    await service.clockOff('line-1', 'tech-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'clock-1' }, data: { clockOff: expect.any(Date) } }),
    );
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

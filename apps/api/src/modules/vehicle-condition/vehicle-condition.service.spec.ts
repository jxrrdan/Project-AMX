import { NotFoundException } from '@nestjs/common';
import { ConditionCheckStage, DamageSeverity } from '@project-amx/shared';
import { VehicleConditionService } from './vehicle-condition.service';

describe('VehicleConditionService.recordForCourtesyBooking', () => {
  const dealerId = 'dealer-1';

  it('throws when the booking does not belong to this dealer', async () => {
    const create = jest.fn();
    const prisma = { courtesyBooking: { findFirst: jest.fn().mockResolvedValue(null) }, vehicleConditionReport: { create } };
    const service = new VehicleConditionService(prisma as never);

    await expect(
      service.recordForCourtesyBooking(dealerId, 'other-dealer-booking', { stage: ConditionCheckStage.INITIAL }),
    ).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a report with its damage markers, scoped to the dealer and booking', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'report-1' });
    const prisma = {
      courtesyBooking: { findFirst: jest.fn().mockResolvedValue({ id: 'booking-1' }) },
      vehicleConditionReport: { create },
    };
    const service = new VehicleConditionService(prisma as never);

    await service.recordForCourtesyBooking(dealerId, 'booking-1', {
      stage: ConditionCheckStage.INITIAL,
      mileage: 12000,
      notes: 'Clean, no issues',
      damageMarkers: [{ location: 'front-bumper', description: 'small scuff', severity: DamageSeverity.MINOR }],
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dealerId,
        courtesyBookingId: 'booking-1',
        jobCardId: undefined,
        stage: ConditionCheckStage.INITIAL,
        mileage: 12000,
        notes: 'Clean, no issues',
        damageMarkers: { create: [{ location: 'front-bumper', description: 'small scuff', severity: DamageSeverity.MINOR, photoUrl: undefined }] },
      }),
      include: { damageMarkers: true },
    });
  });
});

describe('VehicleConditionService.recordForJobCard', () => {
  const dealerId = 'dealer-1';

  it('throws when the job card does not belong to this dealer', async () => {
    const create = jest.fn();
    const prisma = { jobCard: { findFirst: jest.fn().mockResolvedValue(null) }, vehicleConditionReport: { create } };
    const service = new VehicleConditionService(prisma as never);

    await expect(service.recordForJobCard(dealerId, 'other-dealer-job', { stage: ConditionCheckStage.FINAL })).rejects.toThrow(
      NotFoundException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a report linked to the job card, not a courtesy booking', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'report-1' });
    const prisma = {
      jobCard: { findFirst: jest.fn().mockResolvedValue({ id: 'job-1' }) },
      vehicleConditionReport: { create },
    };
    const service = new VehicleConditionService(prisma as never);

    await service.recordForJobCard(dealerId, 'job-1', { stage: ConditionCheckStage.INITIAL });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ jobCardId: 'job-1', courtesyBookingId: undefined }) }),
    );
  });
});

describe('VehicleConditionService list methods', () => {
  it('lists condition reports scoped to the dealer and courtesy booking, ordered oldest first', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { vehicleConditionReport: { findMany } };
    const service = new VehicleConditionService(prisma as never);

    await service.listForCourtesyBooking('dealer-1', 'booking-1');

    expect(findMany).toHaveBeenCalledWith({
      where: { dealerId: 'dealer-1', courtesyBookingId: 'booking-1' },
      include: { damageMarkers: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('lists condition reports scoped to the dealer and job card', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { vehicleConditionReport: { findMany } };
    const service = new VehicleConditionService(prisma as never);

    await service.listForJobCard('dealer-1', 'job-1');

    expect(findMany).toHaveBeenCalledWith({
      where: { dealerId: 'dealer-1', jobCardId: 'job-1' },
      include: { damageMarkers: true },
      orderBy: { createdAt: 'asc' },
    });
  });
});

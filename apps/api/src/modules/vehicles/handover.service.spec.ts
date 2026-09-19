import { NotFoundException } from '@nestjs/common';
import { HandoverType } from '@project-amx/shared';
import { HandoverService } from './handover.service';

function makeEmail() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

describe('HandoverService.create', () => {
  const dealerId = 'dealer-1';

  it('refuses to schedule a handover for a vehicle belonging to another dealer', async () => {
    const vehicleUpdate = jest.fn();
    const appointmentCreate = jest.fn();
    const prisma = {
      vehicle: { findFirst: jest.fn().mockResolvedValue(null), update: vehicleUpdate },
      handoverAppointment: { create: appointmentCreate },
    };
    const service = new HandoverService(prisma as never, makeEmail() as never);
    await expect(
      service.create(dealerId, {
        type: HandoverType.NEW_CAR,
        vehicleId: 'other-dealer-vehicle',
        scheduledAt: '2026-01-01T10:00:00Z',
      } as never),
    ).rejects.toThrow(NotFoundException);
    expect(vehicleUpdate).not.toHaveBeenCalled();
    expect(appointmentCreate).not.toHaveBeenCalled();
  });

  it('schedules the handover and flips the vehicle to ready-for-handover once ownership is confirmed', async () => {
    const vehicleUpdate = jest.fn().mockResolvedValue({});
    const appointmentCreate = jest.fn().mockResolvedValue({ id: 'appointment-1' });
    const prisma = {
      vehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'vehicle-1' }), update: vehicleUpdate },
      handoverAppointment: { create: appointmentCreate },
    };
    const service = new HandoverService(prisma as never, makeEmail() as never);
    await service.create(dealerId, {
      type: HandoverType.NEW_CAR,
      vehicleId: 'vehicle-1',
      scheduledAt: '2026-01-01T10:00:00Z',
    } as never);
    expect(vehicleUpdate).toHaveBeenCalled();
    expect(appointmentCreate).toHaveBeenCalled();
  });

  it('does not touch a vehicle record for a used-car handover with no vehicleId', async () => {
    const vehicleFindFirst = jest.fn();
    const appointmentCreate = jest.fn().mockResolvedValue({ id: 'appointment-1' });
    const prisma = {
      vehicle: { findFirst: vehicleFindFirst },
      handoverAppointment: { create: appointmentCreate },
    };
    const service = new HandoverService(prisma as never, makeEmail() as never);
    await service.create(dealerId, {
      type: HandoverType.USED_CAR,
      usedVehicleId: 'used-vehicle-1',
      scheduledAt: '2026-01-01T10:00:00Z',
    } as never);
    expect(vehicleFindFirst).not.toHaveBeenCalled();
    expect(appointmentCreate).toHaveBeenCalled();
  });
});

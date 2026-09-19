import { NotFoundException } from '@nestjs/common';
import { CourtesyVehicleStatus } from '@project-amx/shared';
import { CourtesyService } from './courtesy.service';

describe('CourtesyService.expiryAlerts', () => {
  it('flags a vehicle whose insurance, MOT, or tax expires within 30 days, and only those', async () => {
    const inDays = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000);
    const prisma = {
      courtesyVehicle: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'safe', insuranceExpiry: inDays(90), motExpiry: inDays(90), taxExpiry: inDays(90) },
          { id: 'insurance-soon', insuranceExpiry: inDays(10), motExpiry: inDays(90), taxExpiry: inDays(90) },
          { id: 'mot-soon', insuranceExpiry: null, motExpiry: inDays(5), taxExpiry: null },
          { id: 'no-dates', insuranceExpiry: null, motExpiry: null, taxExpiry: null },
        ]),
      },
    };
    const service = new CourtesyService(prisma as never);
    const alerts = await service.expiryAlerts('dealer-1');
    expect(alerts.map((v) => v.id)).toEqual(['insurance-soon', 'mot-soon']);
  });
});

describe('CourtesyService.createBooking', () => {
  it('throws when the vehicle does not exist for this dealer', async () => {
    const prisma = { courtesyVehicle: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new CourtesyService(prisma as never);
    await expect(
      service.createBooking('dealer-1', {
        courtesyVehicleId: 'missing',
        customerName: 'A Customer',
        outDate: '2026-01-01',
        expectedReturnDate: '2026-01-05',
      } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses to book a vehicle belonging to another dealer', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { courtesyVehicle: { findFirst } };
    const service = new CourtesyService(prisma as never);
    await expect(
      service.createBooking('dealer-1', {
        courtesyVehicleId: 'dealer-2-vehicle',
        customerName: 'A Customer',
        outDate: '2026-01-01',
        expectedReturnDate: '2026-01-05',
      } as never),
    ).rejects.toThrow(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'dealer-2-vehicle', dealerId: 'dealer-1' } }),
    );
  });

  it('marks the vehicle ON_LOAN when a booking is created', async () => {
    const updateVehicle = jest.fn();
    const prisma = {
      courtesyVehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'v1' }), update: updateVehicle },
      courtesyBooking: { create: jest.fn().mockResolvedValue({ id: 'booking-1' }) },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const service = new CourtesyService(prisma as never);
    await service.createBooking('dealer-1', {
      courtesyVehicleId: 'v1',
      customerName: 'A Customer',
      outDate: '2026-01-01',
      expectedReturnDate: '2026-01-05',
    } as never);
    expect(updateVehicle).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'v1' }, data: { status: CourtesyVehicleStatus.ON_LOAN } }),
    );
  });
});

describe('CourtesyService.returnBooking', () => {
  it('throws when the booking does not exist for this dealer', async () => {
    const prisma = { courtesyBooking: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new CourtesyService(prisma as never);
    await expect(
      service.returnBooking('dealer-1', 'missing', { returnMileage: 1000 } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses to return a booking belonging to another dealer', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { courtesyBooking: { findFirst } };
    const service = new CourtesyService(prisma as never);
    await expect(
      service.returnBooking('dealer-1', 'dealer-2-booking', { returnMileage: 1000 } as never),
    ).rejects.toThrow(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'dealer-2-booking', courtesyVehicle: { dealerId: 'dealer-1' } } }),
    );
  });

  it('marks the vehicle AVAILABLE when returned with no damage', async () => {
    const updateVehicle = jest.fn();
    const prisma = {
      courtesyBooking: {
        findFirst: jest.fn().mockResolvedValue({ id: 'booking-1', courtesyVehicleId: 'v1' }),
        update: jest.fn(),
      },
      courtesyVehicle: { update: updateVehicle },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const service = new CourtesyService(prisma as never);
    await service.returnBooking('dealer-1', 'booking-1', { returnMileage: 12345 } as never);
    expect(updateVehicle).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: CourtesyVehicleStatus.AVAILABLE }) }),
    );
  });

  it('marks the vehicle OFF_ROAD when returned with new damage notes', async () => {
    const updateVehicle = jest.fn();
    const prisma = {
      courtesyBooking: {
        findFirst: jest.fn().mockResolvedValue({ id: 'booking-1', courtesyVehicleId: 'v1' }),
        update: jest.fn(),
      },
      courtesyVehicle: { update: updateVehicle },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const service = new CourtesyService(prisma as never);
    await service.returnBooking('dealer-1', 'booking-1', {
      returnMileage: 12345,
      newDamageNotes: 'Scratched rear bumper',
    } as never);
    expect(updateVehicle).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: CourtesyVehicleStatus.OFF_ROAD }) }),
    );
  });
});

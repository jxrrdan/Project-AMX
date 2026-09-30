import { NotFoundException } from '@nestjs/common';
import { OnlineBookingStatus } from '@project-amx/shared';
import { OnlineBookingService } from './online-booking.service';

const dealerId = 'dealer-1';
const notifications = { create: jest.fn(), createMany: jest.fn().mockResolvedValue({ count: 1 }) };

describe('OnlineBookingService.createPublic', () => {
  it('rejects a submission for an unknown dealer', async () => {
    const prisma = { dealer: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new OnlineBookingService(prisma as never, notifications as never);
    await expect(
      service.createPublic('bad-dealer', { customerName: 'A', vehicleReg: 'AB12CDE', serviceType: 'MOT' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('acknowledges without leaking the record and notifies the triage team', async () => {
    notifications.createMany.mockClear();
    const prisma = {
      dealer: { findUnique: jest.fn().mockResolvedValue({ id: dealerId, name: 'BMW Northampton' }) },
      onlineBookingRequest: { create: jest.fn().mockResolvedValue({ id: 'obr-1' }) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]) },
    };
    const service = new OnlineBookingService(prisma as never, notifications as never);
    const result = await service.createPublic(dealerId, { customerName: 'A', vehicleReg: 'AB12CDE', serviceType: 'MOT' });
    expect(result).toEqual({ received: true, dealerName: 'BMW Northampton' });
    expect(notifications.createMany).toHaveBeenCalledWith(dealerId, ['u1', 'u2'], 'ONLINE_BOOKING', expect.any(String), expect.any(String));
  });
});

describe('OnlineBookingService.updateStatus', () => {
  it('creates a workshop ServiceBooking the first time a request is SCHEDULED', async () => {
    const tx = {
      serviceBooking: { create: jest.fn().mockResolvedValue({ id: 'sb-1' }) },
      onlineBookingRequest: { update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'obr-1', ...data })) },
    };
    const prisma = {
      onlineBookingRequest: {
        findFirst: jest.fn().mockResolvedValue({ id: 'obr-1', dealerId, status: OnlineBookingStatus.NEW, serviceBookingId: null, preferredDate: null, customerName: 'A', contactEmail: null, contactPhone: null, vehicleReg: 'AB12CDE', serviceType: 'MOT' }),
      },
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
    };
    const service = new OnlineBookingService(prisma as never, notifications as never);
    const result = await service.updateStatus(dealerId, 'obr-1', { status: OnlineBookingStatus.SCHEDULED });
    expect(tx.serviceBooking.create).toHaveBeenCalledTimes(1);
    expect(result.serviceBookingId).toBe('sb-1');
  });

  it('does not create a second booking if already converted', async () => {
    const prisma = {
      onlineBookingRequest: {
        findFirst: jest.fn().mockResolvedValue({ id: 'obr-1', dealerId, status: OnlineBookingStatus.SCHEDULED, serviceBookingId: 'sb-existing' }),
        update: jest.fn().mockResolvedValue({ id: 'obr-1' }),
      },
      $transaction: jest.fn(),
    };
    const service = new OnlineBookingService(prisma as never, notifications as never);
    await service.updateStatus(dealerId, 'obr-1', { status: OnlineBookingStatus.SCHEDULED });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.onlineBookingRequest.update).toHaveBeenCalled();
  });

  it('throws when the request is not owned by the dealer', async () => {
    const prisma = { onlineBookingRequest: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new OnlineBookingService(prisma as never, notifications as never);
    await expect(service.updateStatus(dealerId, 'x', { status: OnlineBookingStatus.CONTACTED })).rejects.toThrow(NotFoundException);
  });
});

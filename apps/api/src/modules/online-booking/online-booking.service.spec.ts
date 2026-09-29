import { NotFoundException } from '@nestjs/common';
import { OnlineBookingService } from './online-booking.service';

const dealerId = 'dealer-1';

describe('OnlineBookingService.createPublic', () => {
  it('rejects a submission for an unknown dealer', async () => {
    const prisma = { dealer: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new OnlineBookingService(prisma as never);
    await expect(
      service.createPublic('bad-dealer', { customerName: 'A', vehicleReg: 'AB12CDE', serviceType: 'MOT' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('acknowledges without leaking the stored record back to the anonymous caller', async () => {
    const prisma = {
      dealer: { findUnique: jest.fn().mockResolvedValue({ id: dealerId, name: 'BMW Northampton' }) },
      onlineBookingRequest: { create: jest.fn().mockResolvedValue({ id: 'obr-1', customerName: 'A' }) },
    };
    const service = new OnlineBookingService(prisma as never);
    const result = await service.createPublic(dealerId, { customerName: 'A', vehicleReg: 'AB12CDE', serviceType: 'MOT' });
    expect(result).toEqual({ received: true, dealerName: 'BMW Northampton' });
    expect(prisma.onlineBookingRequest.create).toHaveBeenCalled();
  });
});

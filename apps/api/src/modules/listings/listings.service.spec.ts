import { NotFoundException } from '@nestjs/common';
import { ListingsService } from './listings.service';

describe('ListingsService.resync', () => {
  const dealerId = 'dealer-1';

  it('refuses to resync a listing for another dealer\'s vehicle', async () => {
    const update = jest.fn();
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue(null) },
      vehicleListing: { update },
    };
    const service = new ListingsService(prisma as never);
    await expect(service.resync(dealerId, 'other-dealer-vehicle', 'platform-1')).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('resyncs the listing once vehicle ownership is confirmed', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'listing-1' });
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'vehicle-1' }) },
      vehicleListing: { update },
    };
    const service = new ListingsService(prisma as never);
    await service.resync(dealerId, 'vehicle-1', 'platform-1');
    expect(update).toHaveBeenCalled();
  });
});

describe('ListingsService.listForVehicle', () => {
  const dealerId = 'dealer-1';

  it('refuses to list another dealer\'s vehicle listings', async () => {
    const findMany = jest.fn();
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue(null) },
      vehicleListing: { findMany },
    };
    const service = new ListingsService(prisma as never);
    await expect(service.listForVehicle(dealerId, 'other-dealer-vehicle')).rejects.toThrow(NotFoundException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('lists listings once vehicle ownership is confirmed', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'listing-1' }]);
    const prisma = {
      usedVehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'vehicle-1' }) },
      vehicleListing: { findMany },
    };
    const service = new ListingsService(prisma as never);
    const result = await service.listForVehicle(dealerId, 'vehicle-1');
    expect(result).toEqual([{ id: 'listing-1' }]);
  });
});

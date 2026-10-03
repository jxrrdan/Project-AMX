import { NotFoundException } from '@nestjs/common';
import { RecallVehicleStatus } from '@project-amx/shared';
import { RecallsService } from './recalls.service';

const dealerId = 'dealer-1';

function serviceWith(recallVehicle: Record<string, unknown> | null) {
  const prisma = {
    recallVehicle: {
      findFirst: jest.fn().mockResolvedValue(recallVehicle),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'rv-1', ...data })),
    },
  };
  return { service: new RecallsService(prisma as never), prisma };
}

describe('RecallsService.updateVehicle', () => {
  it('stamps bookedDate when moving to BOOKED', async () => {
    const { service, prisma } = serviceWith({ id: 'rv-1', dealerId, bookedDate: null, completedDate: null });
    await service.updateVehicle(dealerId, 'rv-1', { status: RecallVehicleStatus.BOOKED });
    const data = prisma.recallVehicle.update.mock.calls[0][0].data;
    expect(data.status).toBe(RecallVehicleStatus.BOOKED);
    expect(data.bookedDate).toBeInstanceOf(Date);
  });

  it('stamps completedDate when moving to COMPLETED', async () => {
    const { service, prisma } = serviceWith({ id: 'rv-1', dealerId, bookedDate: new Date(), completedDate: null });
    await service.updateVehicle(dealerId, 'rv-1', { status: RecallVehicleStatus.COMPLETED });
    const data = prisma.recallVehicle.update.mock.calls[0][0].data;
    expect(data.completedDate).toBeInstanceOf(Date);
  });

  it('clears dates when reverting to OUTSTANDING', async () => {
    const { service, prisma } = serviceWith({ id: 'rv-1', dealerId, bookedDate: new Date(), completedDate: new Date() });
    await service.updateVehicle(dealerId, 'rv-1', { status: RecallVehicleStatus.OUTSTANDING });
    const data = prisma.recallVehicle.update.mock.calls[0][0].data;
    expect(data.bookedDate).toBeNull();
    expect(data.completedDate).toBeNull();
  });

  it('throws when the recall vehicle is not owned by the dealer', async () => {
    const { service } = serviceWith(null);
    await expect(service.updateVehicle(dealerId, 'rv-x', { status: RecallVehicleStatus.BOOKED })).rejects.toThrow(NotFoundException);
  });
});

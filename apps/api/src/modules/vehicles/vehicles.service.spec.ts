import { DealSheetStatus, VehiclePipelineStatus } from '@project-amx/shared';
import { VehiclesService } from './vehicles.service';

function makeAudit() {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

describe('VehiclesService.updateStatus', () => {
  const dealerId = 'dealer-1';

  it('marks the ACTIVE sale as SIGNED when the vehicle moves to DELIVERED', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'vehicle-1', status: VehiclePipelineStatus.READY_FOR_HANDOVER }),
        update: jest.fn().mockResolvedValue({ id: 'vehicle-1', status: VehiclePipelineStatus.DELIVERED }),
      },
      newCarSale: { updateMany },
    };
    const service = new VehiclesService(prisma as never, makeAudit() as never);

    await service.updateStatus(dealerId, 'vehicle-1', { status: VehiclePipelineStatus.DELIVERED }, 'user-1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { vehicleId: 'vehicle-1', status: DealSheetStatus.ACTIVE },
      data: { status: DealSheetStatus.SIGNED },
    });
  });

  it('does not touch sales for any other status transition', async () => {
    const updateMany = jest.fn();
    const prisma = {
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'vehicle-1', status: VehiclePipelineStatus.ORDERED }),
        update: jest.fn().mockResolvedValue({ id: 'vehicle-1', status: VehiclePipelineStatus.IN_PRODUCTION }),
      },
      newCarSale: { updateMany },
    };
    const service = new VehiclesService(prisma as never, makeAudit() as never);

    await service.updateStatus(dealerId, 'vehicle-1', { status: VehiclePipelineStatus.IN_PRODUCTION }, 'user-1');

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects a backwards move through the pipeline', async () => {
    const prisma = {
      vehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'vehicle-1', status: VehiclePipelineStatus.PDI_COMPLETE }) },
    };
    const service = new VehiclesService(prisma as never, makeAudit() as never);

    await expect(
      service.updateStatus(dealerId, 'vehicle-1', { status: VehiclePipelineStatus.ORDERED }, 'user-1'),
    ).rejects.toThrow('Vehicles cannot move backwards through the pipeline');
  });
});

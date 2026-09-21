import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DealSheetStatus, ModuleKey, VehiclePipelineStatus } from '@project-amx/shared';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Vehicle Pipeline Board (Feature Spec §1.1), with optional filters. */
  listPipeline(dealerId: string, model?: string, advisorId?: string, status?: VehiclePipelineStatus) {
    return this.prisma.vehicle.findMany({
      where: {
        dealerId,
        model: model ? { contains: model, mode: 'insensitive' } : undefined,
        allocatedAdvisorId: advisorId || undefined,
        status: status || undefined,
      },
      include: { allocatedAdvisor: true, pdiJobs: true },
      orderBy: { eta: 'asc' },
    });
  }

  findOne(dealerId: string, id: string) {
    return this.prisma.vehicle.findFirst({
      where: { id, dealerId },
      include: {
        allocatedAdvisor: true,
        pdiJobs: { include: { checklistItems: true } },
        handoverAppointments: true,
        sales: { orderBy: { createdAt: 'desc' }, include: { tradeIn: true } },
      },
    });
  }

  create(dealerId: string, dto: CreateVehicleDto) {
    return this.prisma.vehicle.create({
      data: {
        dealerId,
        vin: dto.vin,
        model: dto.model,
        colour: dto.colour,
        customerName: dto.customerName,
        eta: dto.eta ? new Date(dto.eta) : undefined,
        allocatedAdvisorId: dto.allocatedAdvisorId,
      },
    });
  }

  /** Drag-and-drop status updates (Feature Spec §1.1) — only forward moves through the pipeline are permitted. */
  async updateStatus(dealerId: string, id: string, dto: UpdateVehicleDto, actingUserId: string) {
    const existing = await this.prisma.vehicle.findFirst({ where: { id, dealerId } });
    if (!existing) {
      throw new NotFoundException('Vehicle not found');
    }

    if (dto.status) {
      const order = Object.values(VehiclePipelineStatus);
      const currentIndex = order.indexOf(existing.status as VehiclePipelineStatus);
      const nextIndex = order.indexOf(dto.status);
      if (nextIndex < currentIndex) {
        throw new BadRequestException('Vehicles cannot move backwards through the pipeline');
      }
    }

    const updated = await this.prisma.vehicle.update({
      where: { id },
      data: {
        status: dto.status,
        eta: dto.eta ? new Date(dto.eta) : undefined,
        allocatedAdvisorId: dto.allocatedAdvisorId,
        customerName: dto.customerName,
      },
    });

    // The vehicle reaching DELIVERED means whichever sale was active for it resulted in a
    // completed sale — record that on the sale itself, same as a used car going SOLD.
    if (dto.status === VehiclePipelineStatus.DELIVERED) {
      await this.prisma.newCarSale.updateMany({
        where: { vehicleId: id, status: DealSheetStatus.ACTIVE },
        data: { status: DealSheetStatus.SIGNED },
      });
    }

    await this.audit.record({
      dealerId,
      userId: actingUserId,
      module: ModuleKey.NEW_CAR_PDI,
      action: 'vehicle.status_change',
      recordType: 'Vehicle',
      recordId: id,
      before: { status: existing.status },
      after: { status: updated.status },
    });

    return updated;
  }
}

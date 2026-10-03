import { Injectable, NotFoundException } from '@nestjs/common';
import { RecallCampaignStatus, RecallVehicleStatus } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AddRecallVehicleDto,
  CreateRecallCampaignDto,
  UpdateRecallCampaignDto,
  UpdateRecallVehicleDto,
} from './dto/recall.dto';

/**
 * Recall Campaign Management — the dealership works an OEM-issued recall/service action to
 * completion across every affected vehicle in its parc. A campaign holds the affected-vehicle
 * list; each vehicle moves OUTSTANDING → BOOKED → COMPLETED independently.
 */
@Injectable()
export class RecallsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCampaigns(dealerId: string, status?: RecallCampaignStatus) {
    const campaigns = await this.prisma.recallCampaign.findMany({
      where: { dealerId, status: status || undefined },
      include: { vehicles: { select: { status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    // Flatten the per-vehicle statuses into headline counts for the list view.
    return campaigns.map(({ vehicles, ...campaign }) => ({
      ...campaign,
      totalVehicles: vehicles.length,
      outstanding: vehicles.filter((v) => v.status === RecallVehicleStatus.OUTSTANDING).length,
      booked: vehicles.filter((v) => v.status === RecallVehicleStatus.BOOKED).length,
      completed: vehicles.filter((v) => v.status === RecallVehicleStatus.COMPLETED).length,
    }));
  }

  findOne(dealerId: string, id: string) {
    return this.prisma.recallCampaign.findFirst({
      where: { id, dealerId },
      include: { vehicles: { orderBy: { createdAt: 'asc' } } },
    });
  }

  createCampaign(dealerId: string, dto: CreateRecallCampaignDto) {
    return this.prisma.recallCampaign.create({
      data: {
        dealerId,
        code: dto.code,
        title: dto.title,
        description: dto.description,
        affectedModels: dto.affectedModels,
        launchedAt: dto.launchedAt ? new Date(dto.launchedAt) : undefined,
      },
    });
  }

  async updateCampaign(dealerId: string, id: string, dto: UpdateRecallCampaignDto) {
    await this.ensureCampaign(dealerId, id);
    return this.prisma.recallCampaign.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        affectedModels: dto.affectedModels,
        status: dto.status,
        launchedAt: dto.launchedAt ? new Date(dto.launchedAt) : undefined,
      },
    });
  }

  async addVehicle(dealerId: string, campaignId: string, dto: AddRecallVehicleDto) {
    await this.ensureCampaign(dealerId, campaignId);
    return this.prisma.recallVehicle.create({
      data: {
        dealerId,
        campaignId,
        vin: dto.vin,
        registration: dto.registration,
        customerName: dto.customerName,
        customerContact: dto.customerContact,
        vehicleId: dto.vehicleId,
        notes: dto.notes,
      },
    });
  }

  /** Update remediation progress for one affected vehicle, stamping the booked/completed dates as
   * the status advances so the campaign progress is auditable without a separate action. */
  async updateVehicle(dealerId: string, vehicleId: string, dto: UpdateRecallVehicleDto) {
    const recallVehicle = await this.prisma.recallVehicle.findFirst({
      where: { id: vehicleId, dealerId },
    });
    if (!recallVehicle) {
      throw new NotFoundException('Recall vehicle not found');
    }

    const data: {
      status?: RecallVehicleStatus;
      customerContact?: string;
      notes?: string;
      bookedDate?: Date | null;
      completedDate?: Date | null;
    } = {
      customerContact: dto.customerContact,
      notes: dto.notes,
    };

    if (dto.status) {
      data.status = dto.status;
      if (dto.status === RecallVehicleStatus.BOOKED) {
        data.bookedDate = dto.bookedDate ? new Date(dto.bookedDate) : recallVehicle.bookedDate ?? new Date();
      }
      if (dto.status === RecallVehicleStatus.COMPLETED) {
        data.bookedDate = recallVehicle.bookedDate ?? new Date();
        data.completedDate = new Date();
      }
      if (dto.status === RecallVehicleStatus.OUTSTANDING) {
        data.bookedDate = null;
        data.completedDate = null;
      }
    } else if (dto.bookedDate) {
      data.bookedDate = new Date(dto.bookedDate);
    }

    return this.prisma.recallVehicle.update({ where: { id: vehicleId }, data });
  }

  async removeVehicle(dealerId: string, vehicleId: string) {
    const recallVehicle = await this.prisma.recallVehicle.findFirst({ where: { id: vehicleId, dealerId } });
    if (!recallVehicle) {
      throw new NotFoundException('Recall vehicle not found');
    }
    await this.prisma.recallVehicle.delete({ where: { id: vehicleId } });
    return { deleted: true };
  }

  /** Outstanding-work summary across all open campaigns — drives the module's headline figures. */
  async outstandingSummary(dealerId: string) {
    const vehicles = await this.prisma.recallVehicle.findMany({
      where: { dealerId, campaign: { status: RecallCampaignStatus.OPEN } },
      select: { status: true },
    });
    return {
      openCampaigns: await this.prisma.recallCampaign.count({
        where: { dealerId, status: RecallCampaignStatus.OPEN },
      }),
      outstanding: vehicles.filter((v) => v.status === RecallVehicleStatus.OUTSTANDING).length,
      booked: vehicles.filter((v) => v.status === RecallVehicleStatus.BOOKED).length,
      completed: vehicles.filter((v) => v.status === RecallVehicleStatus.COMPLETED).length,
    };
  }

  private async ensureCampaign(dealerId: string, id: string) {
    const campaign = await this.prisma.recallCampaign.findFirst({ where: { id, dealerId } });
    if (!campaign) {
      throw new NotFoundException('Recall campaign not found');
    }
    return campaign;
  }
}

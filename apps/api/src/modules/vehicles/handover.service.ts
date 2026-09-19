import { Injectable, NotFoundException } from '@nestjs/common';
import { HandoverType, VehiclePipelineStatus } from '@project-amx/shared';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CompleteHandoverDto, CreateHandoverDto } from './dto/handover.dto';

/** Handover Management — Feature Spec §1.5 (new car) and §4.6 (used car, same flow). */
@Injectable()
export class HandoverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  list(dealerId: string) {
    return this.prisma.handoverAppointment.findMany({
      where: { dealerId },
      include: { vehicle: true, usedVehicle: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async create(dealerId: string, dto: CreateHandoverDto) {
    if (dto.type === HandoverType.NEW_CAR && dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({ where: { id: dto.vehicleId, dealerId } });
      if (!vehicle) {
        throw new NotFoundException('Vehicle not found');
      }
      await this.prisma.vehicle.update({
        where: { id: dto.vehicleId },
        data: { status: VehiclePipelineStatus.READY_FOR_HANDOVER },
      });
    }
    return this.prisma.handoverAppointment.create({
      data: {
        dealerId,
        type: dto.type,
        vehicleId: dto.vehicleId,
        usedVehicleId: dto.usedVehicleId,
        scheduledAt: new Date(dto.scheduledAt),
        advisorId: dto.advisorId,
      },
    });
  }

  /** Digital signature capture + auto confirmation email on completion (Feature Spec §1.5). */
  async complete(dealerId: string, id: string, dto: CompleteHandoverDto) {
    const appointment = await this.prisma.handoverAppointment.findFirst({
      where: { id, dealerId },
      include: { vehicle: true, usedVehicle: true },
    });
    if (!appointment) {
      throw new NotFoundException('Handover appointment not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const completed = await tx.handoverAppointment.update({
        where: { id },
        data: { signatureUrl: dto.signatureUrl, completedAt: new Date(), confirmationEmailSentAt: new Date() },
      });
      if (appointment.vehicleId) {
        await tx.vehicle.update({ where: { id: appointment.vehicleId }, data: { status: VehiclePipelineStatus.DELIVERED } });
      }
      if (appointment.usedVehicleId) {
        await tx.usedVehicle.update({ where: { id: appointment.usedVehicleId }, data: { status: 'DELIVERED', soldAt: new Date() } });
      }
      return completed;
    });

    const customerName =
      appointment.vehicle?.customerName ?? 'Valued customer';
    await this.email.send({
      to: 'customer@example.co.uk',
      subject: 'Your vehicle handover is confirmed',
      html: `<p>Hi ${customerName},</p><p>Thank you for your handover today. Congratulations on your new vehicle!</p>`,
    });

    return updated;
  }
}

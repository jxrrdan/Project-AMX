import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnlineBookingStatus, SystemRole } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOnlineBookingDto, UpdateOnlineBookingDto } from './dto/online-booking.dto';

/** Roles that should hear about a new online booking request. */
const TRIAGE_ROLES = [SystemRole.WORKSHOP_CONTROLLER, SystemRole.SERVICE_ADVISOR];

/**
 * Customer portal / online booking (#4) — the public-facing service-booking request. Customers
 * submit through an unauthenticated portal page; staff triage the queue (NEW → CONTACTED →
 * SCHEDULED/DECLINED). On submission the triage team is notified; on SCHEDULED the request is
 * converted into a real workshop ServiceBooking so it drops into the workshop's normal flow.
 */
@Injectable()
export class OnlineBookingService {
  private readonly logger = new Logger(OnlineBookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Public submission — dealerId comes from the portal URL; validated to exist before writing. */
  async createPublic(dealerId: string, dto: CreateOnlineBookingDto) {
    const dealer = await this.prisma.dealer.findUnique({ where: { id: dealerId }, select: { id: true, name: true } });
    if (!dealer) {
      throw new NotFoundException('Dealer not found');
    }
    await this.prisma.onlineBookingRequest.create({
      data: {
        dealerId,
        customerName: dto.customerName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        vehicleReg: dto.vehicleReg,
        serviceType: dto.serviceType,
        preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : undefined,
        notes: dto.notes,
      },
    });
    await this.notifyTriageTeam(dealerId, dto.customerName, dto.vehicleReg, dto.serviceType);
    // Don't leak the stored record back to an anonymous caller — just acknowledge.
    return { received: true, dealerName: dealer.name };
  }

  findAll(dealerId: string, status?: OnlineBookingStatus) {
    return this.prisma.onlineBookingRequest.findMany({
      where: { dealerId, status: status || undefined },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(dealerId: string, id: string, dto: UpdateOnlineBookingDto) {
    const request = await this.prisma.onlineBookingRequest.findFirst({ where: { id, dealerId } });
    if (!request) {
      throw new NotFoundException('Booking request not found');
    }

    // Converting to SCHEDULED for the first time creates a real workshop booking so the request
    // enters the workshop's normal flow. serviceBookingId guards against duplicate creation if the
    // status is toggled again.
    const converting =
      dto.status === OnlineBookingStatus.SCHEDULED &&
      request.status !== OnlineBookingStatus.SCHEDULED &&
      !request.serviceBookingId;

    if (!converting) {
      return this.prisma.onlineBookingRequest.update({ where: { id }, data: { status: dto.status } });
    }

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.serviceBooking.create({
        data: {
          dealerId,
          customerName: request.customerName,
          contactEmail: request.contactEmail,
          contactPhone: request.contactPhone,
          vehicleReg: request.vehicleReg,
          serviceType: request.serviceType,
          requestedSlot: request.preferredDate ?? new Date(),
          status: 'CONFIRMED',
        },
      });
      return tx.onlineBookingRequest.update({
        where: { id },
        data: { status: dto.status, serviceBookingId: booking.id },
      });
    });
  }

  private async notifyTriageTeam(dealerId: string, customerName: string, vehicleReg: string, serviceType: string) {
    try {
      const staff = await this.prisma.user.findMany({
        where: { dealerId, active: true, roles: { some: { role: { systemRole: { in: TRIAGE_ROLES } } } } },
        select: { id: true },
      });
      await this.notifications.createMany(
        dealerId,
        staff.map((u) => u.id),
        'ONLINE_BOOKING',
        'New online booking request',
        `${customerName} requested "${serviceType}" for ${vehicleReg}.`,
      );
    } catch (err) {
      // A notification failure must never break the public submission.
      this.logger.warn(`Failed to notify triage team of a new booking: ${err instanceof Error ? err.message : err}`);
    }
  }
}

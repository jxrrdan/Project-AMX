import { Injectable, NotFoundException } from '@nestjs/common';
import { OnlineBookingStatus } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateOnlineBookingDto, UpdateOnlineBookingDto } from './dto/online-booking.dto';

/**
 * Customer portal / online booking (#4) — the public-facing service-booking request. Customers
 * submit through an unauthenticated portal page; staff triage the queue (NEW → CONTACTED →
 * SCHEDULED/DECLINED) and convert accepted requests into real workshop bookings.
 */
@Injectable()
export class OnlineBookingService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.onlineBookingRequest.update({ where: { id }, data: { status: dto.status } });
  }
}

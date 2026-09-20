import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateConditionReportDto } from './dto/condition-report.dto';

/**
 * Structured, itemised vehicle condition/damage checks — shared by courtesy/loan car bookings
 * (INITIAL when the car leaves with the customer, FINAL when it's returned) and workshop job cards
 * (INITIAL when the customer's own car is dropped off, FINAL when it's handed back), rather than
 * each module reimplementing this. Replaces relying on a single free-text "newDamageNotes" field
 * with itemised entries (location/description/severity), while every check still still scopes
 * through its parent record (CourtesyBooking or JobCard) to enforce tenant isolation.
 */
@Injectable()
export class VehicleConditionService {
  constructor(private readonly prisma: PrismaService) {}

  async recordForCourtesyBooking(dealerId: string, courtesyBookingId: string, dto: CreateConditionReportDto) {
    const booking = await this.prisma.courtesyBooking.findFirst({
      where: { id: courtesyBookingId, courtesyVehicle: { dealerId } },
    });
    if (!booking) {
      throw new NotFoundException('Courtesy booking not found');
    }
    return this.createReport(dealerId, { courtesyBookingId }, dto);
  }

  listForCourtesyBooking(dealerId: string, courtesyBookingId: string) {
    return this.prisma.vehicleConditionReport.findMany({
      where: { dealerId, courtesyBookingId },
      include: { damageMarkers: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async recordForJobCard(dealerId: string, jobCardId: string, dto: CreateConditionReportDto) {
    const jobCard = await this.prisma.jobCard.findFirst({ where: { id: jobCardId, dealerId } });
    if (!jobCard) {
      throw new NotFoundException('Job card not found');
    }
    return this.createReport(dealerId, { jobCardId }, dto);
  }

  listForJobCard(dealerId: string, jobCardId: string) {
    return this.prisma.vehicleConditionReport.findMany({
      where: { dealerId, jobCardId },
      include: { damageMarkers: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  private createReport(dealerId: string, parent: { courtesyBookingId: string } | { jobCardId: string }, dto: CreateConditionReportDto) {
    return this.prisma.vehicleConditionReport.create({
      data: {
        dealerId,
        courtesyBookingId: 'courtesyBookingId' in parent ? parent.courtesyBookingId : undefined,
        jobCardId: 'jobCardId' in parent ? parent.jobCardId : undefined,
        stage: dto.stage,
        mileage: dto.mileage,
        notes: dto.notes,
        photoUrls: dto.photoUrls ?? [],
        damageMarkers: {
          create: (dto.damageMarkers ?? []).map((m) => ({
            location: m.location,
            description: m.description,
            severity: m.severity,
            photoUrl: m.photoUrl,
          })),
        },
      },
      include: { damageMarkers: true },
    });
  }
}

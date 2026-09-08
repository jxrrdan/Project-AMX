import { Injectable, NotFoundException } from '@nestjs/common';
import { CourtesyVehicleStatus } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBookingDto, CreateCourtesyVehicleDto, ReturnBookingDto } from './dto/courtesy.dto';

/** Module 12 — courtesy/loan car fleet. */
@Injectable()
export class CourtesyService {
  constructor(private readonly prisma: PrismaService) {}

  listFleet(dealerId: string) {
    return this.prisma.courtesyVehicle.findMany({ where: { dealerId }, include: { bookings: true } });
  }

  createVehicle(dealerId: string, dto: CreateCourtesyVehicleDto) {
    return this.prisma.courtesyVehicle.create({
      data: {
        dealerId,
        reg: dto.reg,
        make: dto.make,
        model: dto.model,
        colour: dto.colour,
        insuranceExpiry: dto.insuranceExpiry ? new Date(dto.insuranceExpiry) : undefined,
        motExpiry: dto.motExpiry ? new Date(dto.motExpiry) : undefined,
        taxExpiry: dto.taxExpiry ? new Date(dto.taxExpiry) : undefined,
      },
    });
  }

  /** Alerts when insurance, MOT, or tax is within 30 days of expiry (§12.1). */
  async expiryAlerts(dealerId: string) {
    const vehicles = await this.prisma.courtesyVehicle.findMany({ where: { dealerId } });
    const cutoff = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    return vehicles.filter(
      (v) =>
        (v.insuranceExpiry && v.insuranceExpiry <= cutoff) ||
        (v.motExpiry && v.motExpiry <= cutoff) ||
        (v.taxExpiry && v.taxExpiry <= cutoff),
    );
  }

  async createBooking(dto: CreateBookingDto) {
    const vehicle = await this.prisma.courtesyVehicle.findUnique({ where: { id: dto.courtesyVehicleId } });
    if (!vehicle) {
      throw new NotFoundException('Courtesy vehicle not found');
    }
    return this.prisma.$transaction([
      this.prisma.courtesyBooking.create({
        data: { ...dto, outDate: new Date(dto.outDate), expectedReturnDate: new Date(dto.expectedReturnDate) },
      }),
      this.prisma.courtesyVehicle.update({ where: { id: dto.courtesyVehicleId }, data: { status: CourtesyVehicleStatus.ON_LOAN } }),
    ]);
  }

  async returnBooking(bookingId: string, dto: ReturnBookingDto) {
    const booking = await this.prisma.courtesyBooking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return this.prisma.$transaction([
      this.prisma.courtesyBooking.update({
        where: { id: bookingId },
        data: { actualReturnDate: new Date(), returnMileage: dto.returnMileage, newDamageNotes: dto.newDamageNotes },
      }),
      this.prisma.courtesyVehicle.update({
        where: { id: booking.courtesyVehicleId },
        data: {
          status: dto.newDamageNotes ? CourtesyVehicleStatus.OFF_ROAD : CourtesyVehicleStatus.AVAILABLE,
          mileage: dto.returnMileage,
        },
      }),
    ]);
  }

  /** Fleet utilisation report: % of time each car is on loan (§12.4). */
  async utilisationReport(dealerId: string) {
    const vehicles = await this.prisma.courtesyVehicle.findMany({ where: { dealerId }, include: { bookings: true } });
    return vehicles.map((v) => {
      const loanDays = v.bookings.reduce((sum, b) => {
        const end = b.actualReturnDate ?? new Date();
        return sum + Math.max(0, (end.getTime() - b.outDate.getTime()) / 86400000);
      }, 0);
      return { id: v.id, reg: v.reg, loanDays: Math.round(loanDays) };
    });
  }
}

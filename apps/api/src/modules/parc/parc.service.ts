import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateServiceHistoryEntryDto } from './dto/parc.dto';

/** Registrations are normalised (uppercase, no spaces) so lookups match regardless of formatting. */
const normaliseReg = (reg: string) => reg.replace(/\s+/g, '').toUpperCase();

/**
 * Vehicle parc & service history (#5) — a single lifetime record per vehicle registration,
 * aggregating hand-entered/ingested service history with anything else this system knows about
 * that reg (used-car stock, recall involvement). The backbone for "show me everything about this car".
 */
@Injectable()
export class ParcService {
  constructor(private readonly prisma: PrismaService) {}

  addEntry(dealerId: string, dto: CreateServiceHistoryEntryDto) {
    return this.prisma.serviceHistoryEntry.create({
      data: {
        dealerId,
        vehicleReg: normaliseReg(dto.vehicleReg),
        vin: dto.vin,
        entryType: dto.entryType,
        description: dto.description,
        mileage: dto.mileage,
        cost: dto.cost,
        reference: dto.reference,
        performedAt: new Date(dto.performedAt),
      },
    });
  }

  /** The parc list: one row per distinct registration with entry count and latest activity. */
  async list(dealerId: string) {
    const grouped = await this.prisma.serviceHistoryEntry.groupBy({
      by: ['vehicleReg'],
      where: { dealerId },
      _count: { _all: true },
      _max: { performedAt: true },
      orderBy: { _max: { performedAt: 'desc' } },
    });
    return grouped.map((g) => ({
      vehicleReg: g.vehicleReg,
      entries: g._count._all,
      lastActivity: g._max.performedAt,
    }));
  }

  /** The full lifetime record for one registration. */
  async lookup(dealerId: string, reg: string) {
    const vehicleReg = normaliseReg(reg);
    const [entries, usedVehicle, recalls] = await Promise.all([
      this.prisma.serviceHistoryEntry.findMany({
        where: { dealerId, vehicleReg },
        orderBy: { performedAt: 'desc' },
      }),
      this.prisma.usedVehicle.findFirst({ where: { dealerId, reg: { equals: vehicleReg, mode: 'insensitive' } } }),
      this.prisma.recallVehicle.findMany({
        where: { dealerId, registration: { equals: vehicleReg, mode: 'insensitive' } },
        include: { campaign: { select: { code: true, title: true, status: true } } },
      }),
    ]);
    return { vehicleReg, entries, usedVehicle, recalls };
  }
}

import { Injectable } from '@nestjs/common';
import { VehicleSource } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface TradeInInput {
  reg: string;
  make: string;
  model: string;
  colour?: string;
  mileage?: number;
  condition?: string;
  damageNotes?: string;
  photoUrls?: string[];
  agreedValue: number;
}

/**
 * Intake for a customer's trade-in vehicle, shared by used-car deal sheets and new-car sales.
 * A trade-in is always the DEALER's own purchase — whether the car being sold is used (a normal
 * deal sheet) or new under either sale model (RETAIL, where the dealer also owns the new car; or
 * AGENCY, where the OEM is the contracting seller for the new car but has no part in buying the
 * customer's old one) — so this one path handles it identically either way, rather than the two
 * sale flows each reimplementing their own version.
 *
 * Creates a new UsedVehicle stock record (source: PART_EX) and its PartExchangeAppraisal in a
 * single step, linked back to whichever sale generated it — replacing the old two-step flow of
 * manually adding the vehicle to stock and only then, separately, recording its appraisal.
 */
@Injectable()
export class TradeInService {
  constructor(private readonly prisma: PrismaService) {}

  async intake(dealerId: string, tradeIn: TradeInInput, link: { dealSheetId: string } | { newCarSaleId: string }) {
    const usedVehicle = await this.prisma.usedVehicle.create({
      data: {
        dealerId,
        reg: tradeIn.reg,
        make: tradeIn.make,
        model: tradeIn.model,
        colour: tradeIn.colour,
        mileage: tradeIn.mileage,
        source: VehicleSource.PART_EX,
        purchasePrice: tradeIn.agreedValue,
      },
    });
    const appraisal = await this.prisma.partExchangeAppraisal.create({
      data: {
        usedVehicleId: usedVehicle.id,
        condition: tradeIn.condition,
        mileage: tradeIn.mileage,
        damageNotes: tradeIn.damageNotes,
        photoUrls: tradeIn.photoUrls ?? [],
        agreedValue: tradeIn.agreedValue,
        dealSheetId: 'dealSheetId' in link ? link.dealSheetId : undefined,
        newCarSaleId: 'newCarSaleId' in link ? link.newCarSaleId : undefined,
      },
    });
    return { usedVehicle, appraisal };
  }
}

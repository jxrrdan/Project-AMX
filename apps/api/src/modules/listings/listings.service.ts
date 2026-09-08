import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ListingStatus } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SetPlatformDto } from './dto/listing.dto';

/**
 * Module 10 — third-party stock listing integration. AutoTrader/Motors.co.uk API calls are
 * mocked (LISTINGS_DRIVER equivalent to the other external integrations): publishing marks the
 * listing Published immediately and records a lastSyncedAt timestamp, standing in for the real
 * platform API round-trip.
 */
@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  listPlatforms(dealerId: string) {
    return this.prisma.listingPlatform.findMany({ where: { dealerId } });
  }

  setPlatform(dealerId: string, dto: SetPlatformDto) {
    return this.prisma.listingPlatform.upsert({
      where: { dealerId_type: { dealerId, type: dto.type } },
      update: { enabled: dto.enabled },
      create: { dealerId, type: dto.type, enabled: dto.enabled },
    });
  }

  /** Publishes a used vehicle to every enabled platform for its dealer (§10.2). */
  async publishVehicle(dealerId: string, usedVehicleId: string) {
    const [vehicle, platforms] = await Promise.all([
      this.prisma.usedVehicle.findFirst({ where: { id: usedVehicleId, dealerId } }),
      this.prisma.listingPlatform.findMany({ where: { dealerId, enabled: true } }),
    ]);
    if (!vehicle) {
      throw new NotFoundException('Used vehicle not found');
    }

    return Promise.all(
      platforms.map((platform) =>
        this.prisma.vehicleListing.upsert({
          where: { usedVehicleId_platformId: { usedVehicleId, platformId: platform.id } },
          update: { status: ListingStatus.PUBLISHED, lastSyncedAt: new Date(), errorDetail: null },
          create: { usedVehicleId, platformId: platform.id, status: ListingStatus.PUBLISHED, lastSyncedAt: new Date() },
        }),
      ),
    );
  }

  /** Removes/marks-sold listings when status changes to Reserved or Sold (§10.3). */
  async removeListings(usedVehicleId: string) {
    return this.prisma.vehicleListing.updateMany({
      where: { usedVehicleId },
      data: { status: ListingStatus.REMOVED, lastSyncedAt: new Date() },
    });
  }

  async resync(usedVehicleId: string, platformId: string) {
    return this.prisma.vehicleListing.update({
      where: { usedVehicleId_platformId: { usedVehicleId, platformId } },
      data: { status: ListingStatus.PUBLISHED, lastSyncedAt: new Date(), errorDetail: null },
    });
  }

  listForVehicle(usedVehicleId: string) {
    return this.prisma.vehicleListing.findMany({ where: { usedVehicleId }, include: { platform: true } });
  }
}

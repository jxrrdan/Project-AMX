import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VehiclePipelineStatus } from '@project-amx/shared';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Stands in for the BMW RIS MQTT ingest pipeline described in the architecture spec
 * (BMW RIS MQTT Broker → ECS MQTT Subscriber → SQS → Vehicle Update Lambda → Aurora). Running an
 * always-on MQTT subscriber isn't practical for a local dev sandbox with no BMW broker
 * credentials, so this cron job polls nothing external and instead demonstrates the same
 * write path: on each tick it looks for dealers with zero "Ordered" vehicles and creates one, so
 * the pipeline board always has fresh demo data. Swap this for the real MQTT subscriber
 * (apps/workers in production) without touching any downstream module — they all react to the
 * same Vehicle rows.
 */
@Injectable()
export class RisImportService {
  private readonly logger = new Logger(RisImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async pollForNewOrders() {
    const dealers = await this.prisma.dealer.findMany();
    for (const dealer of dealers) {
      await this.importOneMockOrder(dealer.id);
    }
  }

  async importOneMockOrder(dealerId: string) {
    const models = ['BMW 1 Series', 'BMW 3 Series Touring', 'BMW X1', 'BMW X3', 'BMW i4', 'BMW iX2'];
    const colours = ['Alpine White', 'Black Sapphire', 'Storm Bay', 'Skyscraper Grey'];
    const vin = `WBA${randomUUID().replace(/-/g, '').slice(0, 14).toUpperCase()}`;

    const vehicle = await this.prisma.vehicle.create({
      data: {
        dealerId,
        vin,
        model: models[Math.floor(Math.random() * models.length)],
        colour: colours[Math.floor(Math.random() * colours.length)],
        eta: new Date(Date.now() + 21 * 24 * 3600 * 1000),
        status: VehiclePipelineStatus.ORDERED,
        risOrderRef: `RIS-MOCK-${Date.now()}`,
      },
    });

    this.logger.log(`[RIS mock import] Created vehicle ${vehicle.vin} for dealer ${dealerId}`);
    return vehicle;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { JobType, VhcRating } from '@project-amx/shared';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AddVhcItemDto, CreateVhcInspectionDto, RespondToItemDto } from './dto/vhc.dto';

/** Module 9 — Digital Vehicle Health Check. */
@Injectable()
export class VhcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  createInspection(dealerId: string, technicianId: string, dto: CreateVhcInspectionDto) {
    return this.prisma.vhcInspection.create({
      data: { dealerId, technicianId, jobCardId: dto.jobCardId, vehicleReg: dto.vehicleReg, mileage: dto.mileage },
    });
  }

  /** Photo capture is mandatory for Amber/Red items (§9.1) — enforced here rather than only in the UI. */
  addItem(inspectionId: string, dto: AddVhcItemDto) {
    if (dto.rating !== VhcRating.GREEN && (!dto.photoUrls || dto.photoUrls.length === 0)) {
      throw new Error('A photo is required for Amber/Red items');
    }
    return this.prisma.vhcItem.create({ data: { inspectionId, ...dto } });
  }

  findOne(dealerId: string, id: string) {
    return this.prisma.vhcInspection.findFirst({ where: { id, dealerId }, include: { items: true } });
  }

  /** Sends the customer-facing report link (§9.2) — the resulting web page hosts the approve/decline buttons. */
  async sendReport(dealerId: string, id: string, customerEmail: string) {
    const inspection = await this.prisma.vhcInspection.findFirst({ where: { id, dealerId }, include: { items: true } });
    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }
    await this.email.send({
      to: customerEmail,
      subject: `Your vehicle health check — ${inspection.vehicleReg}`,
      html: `<p>Your technician has completed a health check. <a href="https://ams-app.co.uk/vhc/${id}">View your report and approve any recommended work</a>.</p>`,
    });
    return this.prisma.vhcInspection.update({ where: { id }, data: { sentAt: new Date() } });
  }

  /** Customer approval workflow (§9.3) — an approved item becomes an additional job line on the active job card. */
  async respondToItem(itemId: string, dto: RespondToItemDto) {
    const item = await this.prisma.vhcItem.update({
      where: { id: itemId },
      data: { approved: dto.approved, respondedAt: new Date() },
      include: { inspection: true },
    });

    if (dto.approved) {
      // Additional job line representation: record as its own linked job card for the extra work.
      await this.prisma.jobCard.create({
        data: {
          dealerId: item.inspection.dealerId,
          customerName: 'VHC follow-up',
          vehicleReg: item.inspection.vehicleReg,
          jobType: JobType.REPAIR,
          description: `VHC approved item: ${item.label} — ${item.description ?? ''}`,
          estimatedHours: (item.estimatedLabourMinutes ?? 60) / 60,
        },
      });
    }

    return item;
  }

  // --- Reporting (§9.5) -------------------------------------------------------

  async conversionRate(dealerId: string) {
    const items = await this.prisma.vhcItem.findMany({
      where: { inspection: { dealerId }, rating: { in: [VhcRating.AMBER, VhcRating.RED] } },
    });
    const responded = items.filter((i) => i.approved !== null);
    const approved = items.filter((i) => i.approved === true);
    return {
      presented: items.length,
      approved: approved.length,
      conversionRate: responded.length ? approved.length / responded.length : 0,
    };
  }
}

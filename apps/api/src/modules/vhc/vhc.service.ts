import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JobType, VhcInspectionStatus, VhcRating } from '@project-amx/shared';
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

  listInspections(dealerId: string) {
    return this.prisma.vhcInspection.findMany({
      where: { dealerId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Photo capture is mandatory for Amber/Red items (§9.1) — enforced here rather than only in the UI. */
  async addItem(dealerId: string, inspectionId: string, dto: AddVhcItemDto) {
    const inspection = await this.prisma.vhcInspection.findFirst({ where: { id: inspectionId, dealerId } });
    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }
    if (dto.rating !== VhcRating.GREEN && (!dto.photoUrls || dto.photoUrls.length === 0)) {
      throw new Error('A photo is required for Amber/Red items');
    }
    return this.prisma.vhcItem.create({ data: { inspectionId, ...dto } });
  }

  findOne(dealerId: string, id: string) {
    return this.prisma.vhcInspection.findFirst({ where: { id, dealerId }, include: { items: true } });
  }

  /**
   * The customer-facing report (§9.2) — "no login required", so this is deliberately not
   * dealer-scoped by the caller's session; the inspection's UUID is its own access token, the
   * same pattern as the workshop TV board's token-based read-only URL.
   */
  findPublic(id: string) {
    return this.prisma.vhcInspection.findUnique({
      where: { id },
      include: { items: true },
    });
  }

  /** Technician sign-off (§9.1 gap fix) — distinct from adding items, this is the gate that must be
   * passed before a report can be sent to the customer, so nothing half-finished goes out. */
  async completeInspection(dealerId: string, id: string, completedById: string) {
    const inspection = await this.prisma.vhcInspection.findFirst({ where: { id, dealerId }, include: { items: true } });
    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }
    if (inspection.items.length === 0) {
      throw new BadRequestException('Add at least one item before signing off the inspection');
    }
    return this.prisma.vhcInspection.update({
      where: { id },
      data: { status: VhcInspectionStatus.COMPLETE, completedAt: new Date(), completedById },
    });
  }

  /** Sends the customer-facing report link (§9.2) — the resulting web page hosts the approve/decline buttons.
   * Can only be sent once a technician has signed the inspection off (§9.1 gap fix). */
  async sendReport(dealerId: string, id: string, customerEmail: string) {
    const inspection = await this.prisma.vhcInspection.findFirst({ where: { id, dealerId }, include: { items: true } });
    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }
    if (!inspection.completedAt) {
      throw new BadRequestException('A technician must sign off the inspection before it can be sent to the customer');
    }
    await this.email.send({
      to: customerEmail,
      subject: `Your vehicle health check — ${inspection.vehicleReg}`,
      html: `<p>Your technician has completed a health check. <a href="https://ams-app.co.uk/vhc/${id}">View your report and approve any recommended work</a>.</p>`,
    });
    return this.prisma.vhcInspection.update({
      where: { id },
      data: { sentAt: new Date(), status: VhcInspectionStatus.SENT },
    });
  }

  /** Customer approval workflow (§9.3) — an approved item becomes an additional job line on the active job card,
   * linked back to the item that recommended it (§9.4 gap fix) and billed to the same customer as the original visit. */
  async respondToItem(itemId: string, dto: RespondToItemDto) {
    const item = await this.prisma.vhcItem.update({
      where: { id: itemId },
      data: { approved: dto.approved, respondedAt: new Date() },
      include: { inspection: { include: { jobCard: true } } },
    });

    if (dto.approved) {
      await this.prisma.jobCard.create({
        data: {
          dealerId: item.inspection.dealerId,
          customerName: item.inspection.jobCard.customerName,
          contactId: item.inspection.jobCard.contactId,
          vehicleId: item.inspection.jobCard.vehicleId,
          vehicleReg: item.inspection.vehicleReg,
          jobType: JobType.REPAIR,
          description: `VHC approved item: ${item.label} — ${item.description ?? ''}`,
          estimatedHours: (item.estimatedLabourMinutes ?? 60) / 60,
          sourceVhcItemId: item.id,
        },
      });
    }

    const allItems = await this.prisma.vhcItem.findMany({ where: { inspectionId: item.inspectionId } });
    if (allItems.every((i) => i.respondedAt !== null)) {
      await this.prisma.vhcInspection.update({
        where: { id: item.inspectionId },
        data: { status: VhcInspectionStatus.CLOSED },
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

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JobType, VhcInspectionStatus, VhcRating } from '@project-amx/shared';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AddVhcItemDto, AddVhcItemPartDto, CreateVhcInspectionDto, RespondToItemDto } from './dto/vhc.dto';

const ITEM_INCLUDE = { parts: { include: { part: true } } } as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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

  /** Photo capture is mandatory for Amber/Red items (§9.1) — enforced here rather than only in the UI.
   * Also computes an initial auto-quote (§ VHC auto-quote) from the dealer's labour rate and any
   * manually-typed parts estimate, refined later once real parts are linked (see addItemPart). */
  async addItem(dealerId: string, inspectionId: string, dto: AddVhcItemDto) {
    const inspection = await this.prisma.vhcInspection.findFirst({ where: { id: inspectionId, dealerId } });
    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }
    if (dto.rating !== VhcRating.GREEN && (!dto.photoUrls || dto.photoUrls.length === 0)) {
      throw new Error('A photo is required for Amber/Red items');
    }
    const item = await this.prisma.vhcItem.create({ data: { inspectionId, ...dto } });
    return this.recomputeQuote(dealerId, item.id);
  }

  /** Links a real stocked part to an item, then recomputes its quote (§ VHC auto-quote) from that
   * part's actual costPrice — a real price beats a typed-in guess the moment one is available. */
  async addItemPart(dealerId: string, itemId: string, dto: AddVhcItemPartDto) {
    const item = await this.prisma.vhcItem.findFirst({ where: { id: itemId, inspection: { dealerId } } });
    if (!item) {
      throw new NotFoundException('VHC item not found');
    }
    const part = await this.prisma.part.findFirst({ where: { id: dto.partId, dealerId } });
    if (!part) {
      throw new NotFoundException('Part not found');
    }
    await this.prisma.vhcItemPart.create({ data: { itemId, partId: dto.partId, quantity: dto.quantity ?? 1 } });
    return this.recomputeQuote(dealerId, itemId);
  }

  async removeItemPart(dealerId: string, id: string) {
    const link = await this.prisma.vhcItemPart.findFirst({ where: { id, item: { inspection: { dealerId } } } });
    if (!link) {
      throw new NotFoundException('Linked part not found');
    }
    await this.prisma.vhcItemPart.delete({ where: { id } });
    return this.recomputeQuote(dealerId, link.itemId);
  }

  /**
   * Auto-quote (§ VHC auto-quote): labour from the dealer's own labourRatePerHour (the same rate
   * AftersalesInvoiceService bills at) times the item's estimated labour minutes, plus parts —
   * from real linked Part.costPrice once any are linked, otherwise the technician's typed-in
   * estimatedPartsCost as a fallback before a part has been matched.
   */
  private async recomputeQuote(dealerId: string, itemId: string) {
    const [item, dealer] = await Promise.all([
      this.prisma.vhcItem.findUnique({ where: { id: itemId }, include: ITEM_INCLUDE }),
      this.prisma.dealer.findUnique({ where: { id: dealerId } }),
    ]);
    if (!item) {
      throw new NotFoundException('VHC item not found');
    }
    const labourRate = Number(dealer?.labourRatePerHour ?? 95);
    const quotedLabourCost = round2(((item.estimatedLabourMinutes ?? 0) / 60) * labourRate);
    const quotedPartsCost =
      item.parts.length > 0
        ? round2(item.parts.reduce((sum, link) => sum + link.quantity * Number(link.part.costPrice), 0))
        : round2(Number(item.estimatedPartsCost ?? 0));
    const quotedTotal = round2(quotedLabourCost + quotedPartsCost);

    return this.prisma.vhcItem.update({
      where: { id: itemId },
      data: { quotedLabourCost, quotedPartsCost, quotedTotal },
      include: ITEM_INCLUDE,
    });
  }

  findOne(dealerId: string, id: string) {
    return this.prisma.vhcInspection.findFirst({
      where: { id, dealerId },
      include: { items: { include: ITEM_INCLUDE } },
    });
  }

  /**
   * The customer-facing report (§9.2) — "no login required", so this is deliberately not
   * dealer-scoped by the caller's session; the inspection's UUID is its own access token, the
   * same pattern as the workshop TV board's token-based read-only URL.
   */
  findPublic(id: string) {
    return this.prisma.vhcInspection.findUnique({
      where: { id },
      include: { items: { include: ITEM_INCLUDE } },
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
      include: { inspection: { include: { jobCard: true } }, parts: true },
    });

    if (dto.approved) {
      const jobCard = await this.prisma.jobCard.create({
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
      // Carries the parts identified during the health check straight onto the new job's
      // shortfall-tracking list (see WorkshopService.upcomingPartsShortfalls), rather than the
      // advisor having to re-enter what the quote already knew was needed.
      if (item.parts.length > 0) {
        await this.prisma.jobCardPartRequirement.createMany({
          data: item.parts.map((link) => ({
            dealerId: item.inspection.dealerId,
            jobCardId: jobCard.id,
            partId: link.partId,
            description: item.label,
            quantity: link.quantity,
          })),
        });
      }
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

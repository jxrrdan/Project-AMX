import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  JobType,
  NotificationChannel,
  VhcContactMethod,
  VhcInspectionStatus,
  VhcItemResponseStatus,
  VhcRating,
} from '@project-amx/shared';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AddVhcItemDto,
  AddVhcItemPartDto,
  CreateVhcInspectionDto,
  LogPhoneContactDto,
  RecordInspectionDto,
  RespondToItemDto,
} from './dto/vhc.dto';

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
    private readonly notifications: NotificationsService,
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

  /**
   * Technician sign-off (§9.1 gap fix) — marks the inspection as recorded/videoed, distinct from
   * adding items, and is the gate that must be passed before a report can be sent or the customer
   * contacted. Also notifies the job card's assigned service advisor that it's ready for them to
   * review, price up, and action (§ VHC advisor workflow) — a no-op, not an error, if no advisor is
   * assigned to the job, since that's a data-entry gap elsewhere, not a reason to block the technician.
   */
  async recordInspection(dealerId: string, id: string, recordedById: string, dto: RecordInspectionDto) {
    const inspection = await this.prisma.vhcInspection.findFirst({
      where: { id, dealerId },
      include: { items: true, jobCard: true },
    });
    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }
    if (inspection.items.length === 0) {
      throw new BadRequestException('Add at least one item before signing off the inspection');
    }

    const advisorId = inspection.jobCard.serviceAdvisorId;
    const notifiedServiceAdvisorAt = advisorId ? new Date() : null;
    if (advisorId) {
      await this.notifications.create(
        dealerId,
        advisorId,
        'VHC_READY_FOR_REVIEW',
        'Vehicle health check ready for review',
        `The health check on ${inspection.vehicleReg} has been recorded and is ready for you to price up and contact the customer.`,
        NotificationChannel.EMAIL,
      );
    }

    return this.prisma.vhcInspection.update({
      where: { id },
      data: {
        status: VhcInspectionStatus.RECORDED,
        recordedAt: new Date(),
        recordedById,
        videoUrl: dto.videoUrl,
        notifiedServiceAdvisorAt,
      },
    });
  }

  /** Sends the customer-facing report link (§9.2) — the resulting web page hosts the approve/decline
   * buttons. Can only be sent once a technician has recorded the inspection (§9.1 gap fix). */
  async sendReport(dealerId: string, id: string, customerEmail: string) {
    const inspection = await this.assertRecorded(dealerId, id);
    await this.email.send({
      to: customerEmail,
      subject: `Your vehicle health check — ${inspection.vehicleReg}`,
      html: `<p>Your technician has completed a health check. <a href="https://ams-app.co.uk/vhc/${id}">View your report and approve any recommended work</a>.</p>`,
    });
    return this.prisma.vhcInspection.update({
      where: { id },
      data: { sentAt: new Date(), contactMethod: VhcContactMethod.EMAIL, status: VhcInspectionStatus.SENT },
    });
  }

  /** Logs that the advisor rang the customer instead of (or as well as) emailing the report —
   * an equally valid way to action a recorded inspection (§ VHC advisor workflow). */
  async logPhoneContact(dealerId: string, id: string, dto: LogPhoneContactDto) {
    await this.assertRecorded(dealerId, id);
    return this.prisma.vhcInspection.update({
      where: { id },
      data: {
        contactedAt: new Date(),
        contactMethod: VhcContactMethod.PHONE,
        contactNotes: dto.notes,
        status: VhcInspectionStatus.CONTACTED,
      },
    });
  }

  private async assertRecorded(dealerId: string, id: string) {
    const inspection = await this.prisma.vhcInspection.findFirst({ where: { id, dealerId } });
    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }
    if (!inspection.recordedAt) {
      throw new BadRequestException('A technician must record the inspection before the customer can be contacted');
    }
    return inspection;
  }

  /** Customer (or advisor, on the customer's behalf over the phone) response workflow (§9.3):
   * APPROVED spawns a follow-up job card linked back to the item that recommended it (§9.4 gap fix)
   * and billed to the same customer as the original visit; DECLINED and DEFERRED do not. */
  async respondToItem(itemId: string, dto: RespondToItemDto) {
    const item = await this.prisma.vhcItem.update({
      where: { id: itemId },
      data: { response: dto.response, respondedAt: new Date() },
      include: { inspection: { include: { jobCard: true } }, parts: true },
    });

    if (dto.response === VhcItemResponseStatus.APPROVED) {
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

    await this.closeIfEveryItemResolved(item.inspectionId);
    return item;
  }

  /** Authenticated, dealer-scoped variant of respondToItem for an advisor logging a customer's
   * verbal decision from a phone call, rather than the customer clicking the public report link. */
  async respondToItemAsAdvisor(dealerId: string, itemId: string, dto: RespondToItemDto) {
    const item = await this.prisma.vhcItem.findFirst({ where: { id: itemId, inspection: { dealerId } } });
    if (!item) {
      throw new NotFoundException('VHC item not found');
    }
    return this.respondToItem(itemId, dto);
  }

  /** Deletes an item that was logged in error — only while still PENDING, so nothing that already
   * spawned a follow-up job (APPROVED) or was otherwise recorded as a real decision can vanish
   * silently from the audit trail (§ VHC defer/delete). */
  async removeItem(dealerId: string, itemId: string) {
    const item = await this.prisma.vhcItem.findFirst({ where: { id: itemId, inspection: { dealerId } } });
    if (!item) {
      throw new NotFoundException('VHC item not found');
    }
    if (item.response !== VhcItemResponseStatus.PENDING) {
      throw new BadRequestException('Only a pending item (not yet approved, declined, or deferred) can be deleted');
    }
    await this.prisma.vhcItem.delete({ where: { id: itemId } });
    await this.closeIfEveryItemResolved(item.inspectionId);
    return { success: true };
  }

  private async closeIfEveryItemResolved(inspectionId: string) {
    const allItems = await this.prisma.vhcItem.findMany({ where: { inspectionId } });
    if (allItems.length > 0 && allItems.every((i) => i.response !== VhcItemResponseStatus.PENDING)) {
      await this.prisma.vhcInspection.update({
        where: { id: inspectionId },
        data: { status: VhcInspectionStatus.CLOSED },
      });
    }
  }

  // --- Reporting (§9.5) -------------------------------------------------------

  async conversionRate(dealerId: string) {
    const items = await this.prisma.vhcItem.findMany({
      where: { inspection: { dealerId }, rating: { in: [VhcRating.AMBER, VhcRating.RED] } },
    });
    const responded = items.filter((i) => i.response !== VhcItemResponseStatus.PENDING);
    const approved = items.filter((i) => i.response === VhcItemResponseStatus.APPROVED);
    return {
      presented: items.length,
      approved: approved.length,
      conversionRate: responded.length ? approved.length / responded.length : 0,
    };
  }
}

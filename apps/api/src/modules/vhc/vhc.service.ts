import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { JobType, VhcRating } from '@project-amx/shared';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AddVhcItemDto, CreateVhcInspectionDto, RespondToItemDto } from './dto/vhc.dto';

/** Customer report links stay valid for 30 days, then the dealer must resend. */
const REPORT_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Module 9 — Digital Vehicle Health Check. */
@Injectable()
export class VhcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Unforgeable access token for the customer report link. A bare inspection UUID is an identifier,
   * not a secret (it appears in staff URLs, logs and referrers), so the public report and the
   * approve/decline action both require this HMAC of the inspection id. Stateless — no schema change
   * — and rotating VHC_LINK_SECRET invalidates every issued link.
   */
  reportToken(inspectionId: string, expiresAt = Date.now() + REPORT_LINK_TTL_MS): string {
    return `${expiresAt}.${this.sign(inspectionId, expiresAt)}`;
  }

  private sign(inspectionId: string, expiresAt: number): string {
    const secret = this.config.get<string>('VHC_LINK_SECRET') ?? this.config.get<string>('JWT_ACCESS_SECRET', 'dev-vhc-link-secret');
    return createHmac('sha256', secret).update(`vhc-report:${inspectionId}:${expiresAt}`).digest('base64url');
  }

  private assertReportToken(inspectionId: string, token: string | undefined): void {
    const [expiresRaw = '', signature = ''] = (token ?? '').split('.');
    const expiresAt = Number(expiresRaw);
    const expected = Buffer.from(this.sign(inspectionId, expiresAt));
    const provided = Buffer.from(signature);
    const valid = Number.isFinite(expiresAt) && provided.length === expected.length && timingSafeEqual(provided, expected);
    if (!valid || Date.now() > expiresAt) {
      // Same error as a missing record so the token check can't be used to probe which ids exist.
      throw new NotFoundException('Report not found');
    }
  }

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

  async findOne(dealerId: string, id: string) {
    const inspection = await this.prisma.vhcInspection.findFirst({ where: { id, dealerId }, include: { items: true } });
    return inspection ? { ...inspection, reportToken: this.reportToken(inspection.id) } : null;
  }

  /**
   * The customer-facing report (§9.2) — "no login required", so it is not dealer-scoped by a
   * session; the signed `token` in the link is the access control. Returns only what the customer
   * needs (no dealer/technician/job-card ids).
   */
  async findPublic(id: string, token: string | undefined) {
    this.assertReportToken(id, token);
    const inspection = await this.prisma.vhcInspection.findUnique({ where: { id }, include: { items: true } });
    if (!inspection) {
      throw new NotFoundException('Report not found');
    }
    const { dealerId: _d, technicianId: _t, jobCardId: _j, ...safe } = inspection;
    return safe;
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
      html: `<p>Your technician has completed a health check. <a href="${this.config.get<string>('PUBLIC_WEB_URL', 'https://ams-app.co.uk')}/vhc-report/${id}?t=${this.reportToken(id)}">View your report and approve any recommended work</a>.</p>`,
    });
    return this.prisma.vhcInspection.update({ where: { id }, data: { sentAt: new Date() } });
  }

  /** Customer approval workflow (§9.3) — an approved item becomes an additional job line on the active job card. */
  async respondToItem(itemId: string, token: string | undefined, dto: RespondToItemDto) {
    const existing = await this.prisma.vhcItem.findUnique({ where: { id: itemId } });
    if (!existing) {
      throw new NotFoundException('Report not found');
    }
    this.assertReportToken(existing.inspectionId, token);
    if (existing.respondedAt) {
      // A decision is final from the customer's side; also stops repeat calls spawning duplicate job cards.
      throw new ConflictException('This item has already been answered');
    }
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

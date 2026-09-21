import { Injectable, NotFoundException } from '@nestjs/common';
import { JobCardStatus, ModuleKey } from '@project-amx/shared';
import { addDays } from 'date-fns';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WorkshopGateway } from '../../common/ws/workshop.gateway';
import { CreateBayDto, CreateJobCardDto, SetCapacityDto, UpdateJobCardDto } from './dto/job-card.dto';
import { CreateJobCardOperationLineDto } from './dto/operation-line.dto';
import { CreatePartRequirementDto } from './dto/part-requirement.dto';
import { CreateServiceBookingDto } from './dto/service-booking.dto';

const OPEN_JOB_STATUSES: JobCardStatus[] = [
  JobCardStatus.CREATED,
  JobCardStatus.SCHEDULED,
  JobCardStatus.IN_PROGRESS,
  JobCardStatus.AWAITING_PARTS,
];

@Injectable()
export class WorkshopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: WorkshopGateway,
    private readonly audit: AuditService,
  ) {}

  // --- Bays -------------------------------------------------------------

  listBays(dealerId: string) {
    return this.prisma.bay.findMany({ where: { dealerId }, orderBy: { name: 'asc' } });
  }

  createBay(dealerId: string, dto: CreateBayDto) {
    return this.prisma.bay.create({ data: { dealerId, name: dto.name } });
  }

  // --- Job cards (diary) --------------------------------------------------

  /**
   * The workshop TV board (§2.3) is gated on a dedicated unguessable token, not the dealer's own
   * id — the dealerId is not a secret in this app (it appears in the URL of the public enquiry
   * form, service-booking widget, and chatbot widget), so it must never double as an access
   * control value on its own.
   */
  async getPublicBoard(boardToken: string) {
    const dealer = await this.prisma.dealer.findUnique({ where: { workshopBoardToken: boardToken } });
    if (!dealer) {
      throw new NotFoundException('Board not found');
    }
    return this.listJobCards(dealer.id);
  }

  async listJobCards(dealerId: string, from?: string, to?: string, bayId?: string, technicianId?: string) {
    return this.prisma.jobCard.findMany({
      where: {
        dealerId,
        bayId: bayId || undefined,
        assignedTechnicianId: technicianId || undefined,
        scheduledStart: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      include: { bay: true, assignedTechnician: true, serviceAdvisor: true, timeEntries: true },
      orderBy: { scheduledStart: 'asc' },
    });
  }

  async getJobCard(dealerId: string, id: string) {
    const jobCard = await this.prisma.jobCard.findFirst({
      where: { id, dealerId },
      include: {
        bay: true,
        assignedTechnician: true,
        serviceAdvisor: true,
        timeEntries: { include: { technician: true } },
        partAllocations: { include: { part: true } },
        partRequirements: { include: { part: true } },
      },
    });
    if (!jobCard) {
      throw new NotFoundException('Job card not found');
    }
    return jobCard;
  }

  async createJobCard(dealerId: string, dto: CreateJobCardDto, actingUserId: string) {
    const jobCard = await this.prisma.jobCard.create({
      data: {
        dealerId,
        customerName: dto.customerName,
        contactId: dto.contactId,
        vehicleId: dto.vehicleId,
        vehicleReg: dto.vehicleReg,
        jobType: dto.jobType,
        category: dto.category,
        billingType: dto.billingType,
        description: dto.description,
        estimatedHours: dto.estimatedHours ?? 0,
        bayId: dto.bayId,
        assignedTechnicianId: dto.assignedTechnicianId,
        serviceAdvisorId: dto.serviceAdvisorId,
        scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart) : undefined,
        scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : undefined,
      },
      include: { bay: true, assignedTechnician: true },
    });

    await this.audit.record({
      dealerId,
      userId: actingUserId,
      module: ModuleKey.WORKSHOP,
      action: 'job_card.create',
      recordType: 'JobCard',
      recordId: jobCard.id,
      after: jobCard,
    });
    this.gateway.emitJobCardChanged(dealerId, jobCard);
    return jobCard;
  }

  /** Drag-and-drop rescheduling and status transitions both flow through here so every change broadcasts live. */
  async updateJobCard(dealerId: string, id: string, dto: UpdateJobCardDto, actingUserId: string) {
    const existing = await this.prisma.jobCard.findFirst({ where: { id, dealerId } });
    if (!existing) {
      throw new NotFoundException('Job card not found');
    }

    const jobCard = await this.prisma.jobCard.update({
      where: { id },
      data: {
        status: dto.status,
        category: dto.category,
        billingType: dto.billingType,
        bayId: dto.bayId,
        assignedTechnicianId: dto.assignedTechnicianId,
        scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart) : undefined,
        scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : undefined,
        estimatedHours: dto.estimatedHours,
        description: dto.description,
      },
      include: { bay: true, assignedTechnician: true, timeEntries: true },
    });

    await this.audit.record({
      dealerId,
      userId: actingUserId,
      module: ModuleKey.WORKSHOP,
      action: 'job_card.update',
      recordType: 'JobCard',
      recordId: id,
      before: existing,
      after: jobCard,
    });
    this.gateway.emitJobCardChanged(dealerId, jobCard);
    return jobCard;
  }

  /** Clock on/off per Feature Spec §2.2 "Time tracking per technician per job". */
  async clockOn(dealerId: string, jobCardId: string, technicianId: string) {
    const jobCard = await this.prisma.jobCard.findFirst({ where: { id: jobCardId, dealerId } });
    if (!jobCard) {
      throw new NotFoundException('Job card not found');
    }
    await this.prisma.jobCardTimeEntry.create({
      data: { jobCardId, technicianId, clockOn: new Date() },
    });
    const updated = await this.prisma.jobCard.update({
      where: { id: jobCardId },
      data: { status: JobCardStatus.IN_PROGRESS },
      include: { timeEntries: true },
    });
    this.gateway.emitJobCardChanged(dealerId, updated);
    return updated;
  }

  async clockOff(dealerId: string, jobCardId: string, technicianId: string) {
    const openEntry = await this.prisma.jobCardTimeEntry.findFirst({
      where: { jobCardId, technicianId, clockOff: null },
      orderBy: { clockOn: 'desc' },
    });
    if (!openEntry) {
      throw new NotFoundException('No open clocking found for this technician on this job');
    }
    await this.prisma.jobCardTimeEntry.update({ where: { id: openEntry.id }, data: { clockOff: new Date() } });
    const updated = await this.prisma.jobCard.findUnique({ where: { id: jobCardId }, include: { timeEntries: true } });
    this.gateway.emitJobCardChanged(dealerId, updated);
    return updated;
  }

  // --- Operation lines (per-line technician clocking) ---------------------

  /**
   * A job card's itemised lines of work — each independently clockable, mirroring the
   * WarrantyOperationLine/WarrantyClockEntry pattern but for ordinary (retail/internal) workshop
   * jobs. A job card that never gets any lines keeps using the older whole-job clockOn/clockOff
   * above unchanged; see AftersalesInvoiceService.generate for how invoicing picks between them.
   */
  async addOperationLine(dealerId: string, jobCardId: string, dto: CreateJobCardOperationLineDto) {
    const jobCard = await this.prisma.jobCard.findFirst({ where: { id: jobCardId, dealerId } });
    if (!jobCard) {
      throw new NotFoundException('Job card not found');
    }
    return this.prisma.jobCardOperationLine.create({ data: { jobCardId, ...dto } });
  }

  listOperationLines(dealerId: string, jobCardId: string) {
    return this.prisma.jobCardOperationLine.findMany({
      where: { jobCardId, jobCard: { dealerId } },
      include: { clockEntries: { include: { technician: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async clockOnLine(dealerId: string, lineId: string, technicianId: string) {
    const line = await this.prisma.jobCardOperationLine.findFirst({ where: { id: lineId, jobCard: { dealerId } } });
    if (!line) {
      throw new NotFoundException('Operation line not found');
    }
    await this.prisma.jobCardLineClockEntry.create({ data: { lineId, technicianId, clockOn: new Date() } });
    const updated = await this.prisma.jobCard.update({
      where: { id: line.jobCardId },
      data: { status: JobCardStatus.IN_PROGRESS },
      include: { operationLines: { include: { clockEntries: true } } },
    });
    this.gateway.emitJobCardChanged(dealerId, updated);
    return updated;
  }

  async clockOffLine(dealerId: string, lineId: string, technicianId: string) {
    const line = await this.prisma.jobCardOperationLine.findFirst({ where: { id: lineId, jobCard: { dealerId } } });
    if (!line) {
      throw new NotFoundException('Operation line not found');
    }
    const open = await this.prisma.jobCardLineClockEntry.findFirst({
      where: { lineId, technicianId, clockOff: null },
      orderBy: { clockOn: 'desc' },
    });
    if (!open) {
      throw new NotFoundException('No open clocking found for this technician on this line');
    }
    await this.prisma.jobCardLineClockEntry.update({ where: { id: open.id }, data: { clockOff: new Date() } });
    const updated = await this.prisma.jobCard.findUnique({
      where: { id: line.jobCardId },
      include: { operationLines: { include: { clockEntries: true } } },
    });
    this.gateway.emitJobCardChanged(dealerId, updated);
    return updated;
  }

  // --- Capacity -----------------------------------------------------------

  async listCapacity(dealerId: string, from: string, to: string) {
    return this.prisma.capacityBlock.findMany({
      where: { dealerId, date: { gte: new Date(from), lte: new Date(to) } },
      include: { bay: true },
    });
  }

  async setCapacity(dealerId: string, dto: SetCapacityDto) {
    const result = await this.prisma.capacityBlock.upsert({
      where: { bayId_date: { bayId: dto.bayId, date: new Date(dto.date) } },
      update: { availableMinutes: dto.availableMinutes, reason: dto.reason },
      create: {
        dealerId,
        bayId: dto.bayId,
        date: new Date(dto.date),
        availableMinutes: dto.availableMinutes,
        reason: dto.reason,
      },
    });
    this.gateway.emitCapacityChanged(dealerId);
    return result;
  }

  // --- Service bookings (Module 2.5) --------------------------------------

  listServiceBookings(dealerId: string) {
    return this.prisma.serviceBooking.findMany({ where: { dealerId }, orderBy: { requestedSlot: 'asc' } });
  }

  createServiceBooking(dealerId: string, dto: CreateServiceBookingDto) {
    return this.prisma.serviceBooking.create({
      data: {
        dealerId,
        customerName: dto.customerName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        vehicleReg: dto.vehicleReg,
        serviceType: dto.serviceType,
        requestedSlot: new Date(dto.requestedSlot),
      },
    });
  }

  async confirmServiceBooking(dealerId: string, id: string) {
    const booking = await this.prisma.serviceBooking.findFirst({ where: { id, dealerId } });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return this.prisma.serviceBooking.update({ where: { id }, data: { status: 'CONFIRMED' } });
  }

  // --- Workshop loading (capacity utilisation) --------------------------------

  /** Per-bay, per-day booked hours against configured capacity — the "how full is the workshop"
   * view the diary/kanban alone doesn't answer. Days/bays with no CapacityBlock row show
   * utilisationPct: null (capacity was never configured) rather than a misleading 0%/Infinity%. */
  async loadingReport(dealerId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const [capacityBlocks, jobCards, bays] = await Promise.all([
      this.prisma.capacityBlock.findMany({ where: { dealerId, date: { gte: fromDate, lte: toDate } } }),
      this.prisma.jobCard.findMany({
        where: { dealerId, bayId: { not: null }, scheduledStart: { gte: fromDate, lte: toDate } },
        select: { bayId: true, scheduledStart: true, estimatedHours: true },
      }),
      this.prisma.bay.findMany({ where: { dealerId } }),
    ]);

    const bookedMinutesByKey = new Map<string, number>();
    for (const jc of jobCards) {
      if (!jc.bayId || !jc.scheduledStart) continue;
      const key = `${jc.bayId}|${jc.scheduledStart.toISOString().slice(0, 10)}`;
      bookedMinutesByKey.set(key, (bookedMinutesByKey.get(key) ?? 0) + Number(jc.estimatedHours) * 60);
    }

    const bayNameById = new Map(bays.map((b) => [b.id, b.name]));
    const rows = capacityBlocks.map((block) => {
      const key = `${block.bayId}|${block.date.toISOString().slice(0, 10)}`;
      const bookedMinutes = bookedMinutesByKey.get(key) ?? 0;
      bookedMinutesByKey.delete(key);
      return {
        bayId: block.bayId,
        bayName: bayNameById.get(block.bayId) ?? 'Unknown bay',
        date: block.date.toISOString().slice(0, 10),
        capacityMinutes: block.availableMinutes,
        bookedMinutes,
        utilisationPct: block.availableMinutes > 0 ? Math.round((bookedMinutes / block.availableMinutes) * 100) : null,
      };
    });

    // Any bay/day with booked jobs but no CapacityBlock configured — still worth surfacing, just
    // with utilisationPct: null since there's nothing to measure it against.
    for (const [key, bookedMinutes] of bookedMinutesByKey) {
      const [bayId, date] = key.split('|');
      rows.push({ bayId, bayName: bayNameById.get(bayId) ?? 'Unknown bay', date, capacityMinutes: 0, bookedMinutes, utilisationPct: null });
    }

    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.bayName.localeCompare(b.bayName));
  }

  // --- Parts required for upcoming jobs ---------------------------------------

  async addPartRequirement(dealerId: string, jobCardId: string, dto: CreatePartRequirementDto) {
    const jobCard = await this.prisma.jobCard.findFirst({ where: { id: jobCardId, dealerId } });
    if (!jobCard) {
      throw new NotFoundException('Job card not found');
    }
    if (dto.partId) {
      const part = await this.prisma.part.findFirst({ where: { id: dto.partId, dealerId } });
      if (!part) {
        throw new NotFoundException('Part not found');
      }
    }
    return this.prisma.jobCardPartRequirement.create({
      data: { dealerId, jobCardId, partId: dto.partId, description: dto.description, quantity: dto.quantity ?? 1 },
    });
  }

  listPartRequirements(dealerId: string, jobCardId: string) {
    return this.prisma.jobCardPartRequirement.findMany({ where: { dealerId, jobCardId }, include: { part: true } });
  }

  async removePartRequirement(dealerId: string, id: string) {
    const requirement = await this.prisma.jobCardPartRequirement.findFirst({ where: { id, dealerId } });
    if (!requirement) {
      throw new NotFoundException('Part requirement not found');
    }
    await this.prisma.jobCardPartRequirement.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Parts needed for jobs scheduled in the next `days` (default 7) that would leave stock short —
   * i.e. flags a shortage BEFORE the job's day arrives, rather than only when someone tries to
   * allocate the part and finds there isn't enough (see PartsService.allocateToJob).
   */
  async upcomingPartsShortfalls(dealerId: string, days = 7) {
    const cutoff = addDays(new Date(), days);
    const requirements = await this.prisma.jobCardPartRequirement.findMany({
      where: {
        dealerId,
        jobCard: { scheduledStart: { lte: cutoff }, status: { in: OPEN_JOB_STATUSES } },
      },
      include: { part: true, jobCard: { select: { id: true, customerName: true, vehicleReg: true, scheduledStart: true } } },
    });

    const byPart = new Map<
      string,
      { partId: string; partNumber: string; description: string; quantityOnHand: number; quantityRequired: number; jobCards: Set<string> }
    >();
    const unmatched: { description: string; quantity: number; jobCardId: string; customerName: string }[] = [];

    for (const req of requirements) {
      if (!req.partId || !req.part) {
        unmatched.push({
          description: req.description,
          quantity: req.quantity,
          jobCardId: req.jobCard.id,
          customerName: req.jobCard.customerName,
        });
        continue;
      }
      const existing = byPart.get(req.partId);
      if (existing) {
        existing.quantityRequired += req.quantity;
        existing.jobCards.add(req.jobCard.id);
      } else {
        byPart.set(req.partId, {
          partId: req.partId,
          partNumber: req.part.partNumber,
          description: req.part.description,
          quantityOnHand: req.part.quantityOnHand,
          quantityRequired: req.quantity,
          jobCards: new Set([req.jobCard.id]),
        });
      }
    }

    const shortfalls = [...byPart.values()]
      .filter((p) => p.quantityRequired > p.quantityOnHand)
      .map((p) => ({
        partId: p.partId,
        partNumber: p.partNumber,
        description: p.description,
        quantityOnHand: p.quantityOnHand,
        quantityRequired: p.quantityRequired,
        shortfall: p.quantityRequired - p.quantityOnHand,
        jobCardCount: p.jobCards.size,
      }));

    return { shortfalls, unmatched };
  }
}

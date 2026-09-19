import { Injectable, NotFoundException } from '@nestjs/common';
import { JobCardStatus, ModuleKey } from '@project-amx/shared';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WorkshopGateway } from '../../common/ws/workshop.gateway';
import { CreateBayDto, CreateJobCardDto, SetCapacityDto, UpdateJobCardDto } from './dto/job-card.dto';
import { CreateServiceBookingDto } from './dto/service-booking.dto';

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

  async createJobCard(dealerId: string, dto: CreateJobCardDto, actingUserId: string) {
    const jobCard = await this.prisma.jobCard.create({
      data: {
        dealerId,
        customerName: dto.customerName,
        contactId: dto.contactId,
        vehicleId: dto.vehicleId,
        vehicleReg: dto.vehicleReg,
        jobType: dto.jobType,
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
}

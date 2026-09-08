import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStage } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateActivityDto, CreateContactDto, CreateLeadDto, CreateTaskDto, UpdateLeadStageDto } from './dto/contact.dto';

/** Module 8 — contacts, leads, activities and follow-up tasks (§8.1-8.4). */
@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Contacts (§8.1, §8.3) -----------------------------------------------

  listContacts(dealerId: string, search?: string) {
    return this.prisma.contact.findMany({
      where: {
        dealerId,
        OR: search
          ? [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findContact(dealerId: string, id: string) {
    return this.prisma.contact.findFirst({
      where: { id, dealerId },
      include: { leads: true, activities: true, tasks: true, emails: true, smsMessages: true },
    });
  }

  /** Duplicate detection on email/phone before creating a new lead/contact (§8.1). */
  async createContact(dealerId: string, dto: CreateContactDto) {
    if (dto.email || dto.phone) {
      const duplicate = await this.prisma.contact.findFirst({
        where: {
          dealerId,
          OR: [dto.email ? { email: dto.email } : undefined, dto.phone ? { phone: dto.phone } : undefined].filter(
            Boolean,
          ) as object[],
        },
      });
      if (duplicate) {
        throw new BadRequestException('A contact with this email or phone already exists');
      }
    }
    return this.prisma.contact.create({ data: { dealerId, ...dto } });
  }

  // --- Leads (§8.2) ---------------------------------------------------------

  listLeads(dealerId: string, stage?: LeadStage, salespersonId?: string) {
    return this.prisma.lead.findMany({
      where: { dealerId, stage: stage || undefined, assignedSalespersonId: salespersonId || undefined },
      include: { contact: true, usedVehicle: true, assignedSalesperson: true },
      orderBy: { lastActivityAt: 'desc' },
    });
  }

  createLead(dealerId: string, dto: CreateLeadDto) {
    return this.prisma.lead.create({ data: { dealerId, ...dto } });
  }

  /** Lost reason capture is required when moving to Lost (§8.2). */
  async updateStage(dealerId: string, id: string, dto: UpdateLeadStageDto) {
    const lead = await this.prisma.lead.findFirst({ where: { id, dealerId } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    if (dto.stage === LeadStage.LOST && !dto.lostReason) {
      throw new BadRequestException('A lost reason is required when moving a lead to Lost');
    }

    await this.prisma.crmActivity.create({
      data: { leadId: id, type: 'STAGE_CHANGE', notes: `${lead.stage} → ${dto.stage}` },
    });

    return this.prisma.lead.update({
      where: { id },
      data: { stage: dto.stage, lostReason: dto.lostReason, lastActivityAt: new Date() },
    });
  }

  // --- Activity & follow-up (§8.4) ------------------------------------------

  createActivity(dto: CreateActivityDto) {
    return this.prisma.crmActivity.create({ data: dto });
  }

  createTask(dto: CreateTaskDto) {
    return this.prisma.crmTask.create({ data: { ...dto, dueDate: new Date(dto.dueDate) } });
  }

  listOverdueTasks(dealerId: string) {
    return this.prisma.crmTask.findMany({
      where: {
        dueDate: { lt: new Date() },
        completedAt: null,
        OR: [{ contact: { dealerId } }, { lead: { dealerId } }],
      },
      include: { assignee: true },
    });
  }

  completeTask(id: string) {
    return this.prisma.crmTask.update({ where: { id }, data: { completedAt: new Date() } });
  }

  // --- Reporting (§8.10) ------------------------------------------------------

  async pipelineReport(dealerId: string) {
    const leads = await this.prisma.lead.findMany({ where: { dealerId } });
    const bySource = leads.reduce<Record<string, number>>((acc, lead) => {
      acc[lead.source] = (acc[lead.source] ?? 0) + 1;
      return acc;
    }, {});
    const sold = leads.filter((l) => l.stage === LeadStage.SOLD).length;
    return {
      total: leads.length,
      bySource,
      conversionRate: leads.length ? sold / leads.length : 0,
    };
  }
}

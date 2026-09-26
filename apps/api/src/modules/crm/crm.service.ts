import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CrmActivityType, LeadSource, LeadStage } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateActivityDto,
  CreateContactDto,
  CreateEnquiryDto,
  CreateLeadDto,
  CreateTaskDto,
  UpdateLeadStageDto,
} from './dto/contact.dto';

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
      include: {
        leads: true,
        activities: true,
        tasks: true,
        emails: true,
        smsMessages: true,
        whatsAppMessages: true,
        callLogs: true,
      },
    });
  }

  /** Duplicate detection on email/phone before creating a new lead/contact (§8.1). */
  async createContact(dealerId: string, dto: CreateContactDto) {
    const duplicate = await this.findDuplicateContact(dealerId, dto.email, dto.phone);
    if (duplicate) {
      throw new BadRequestException('A contact with this email or phone already exists');
    }
    return this.prisma.contact.create({ data: { dealerId, ...dto } });
  }

  private findDuplicateContact(dealerId: string, email?: string, phone?: string) {
    if (!email && !phone) {
      return null;
    }
    return this.prisma.contact.findFirst({
      where: {
        dealerId,
        OR: [email ? { email } : undefined, phone ? { phone } : undefined].filter(Boolean) as object[],
      },
    });
  }

  /**
   * Public, unauthenticated enquiry capture (Feature Spec §8.1 "Embedded enquiry form (hosted
   * by AMS, embeddable on dealer website)"). Unlike createContact above, a returning customer is
   * never rejected as a duplicate — their enquiry is attached to their existing contact record
   * instead, which is what "duplicate detection ... before creating a new lead" actually means
   * for a form real visitors submit more than once.
   */
  async createEnquiry(dealerId: string, dto: CreateEnquiryDto) {
    const existing = await this.findDuplicateContact(dealerId, dto.email, dto.phone);

    const contact = existing
      ? await this.prisma.contact.update({
          where: { id: existing.id },
          data: { gdprConsent: existing.gdprConsent || dto.gdprConsent },
        })
      : await this.prisma.contact.create({
          data: {
            dealerId,
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            phone: dto.phone,
            gdprConsent: dto.gdprConsent,
          },
        });

    const lead = await this.prisma.lead.create({
      data: {
        dealerId,
        contactId: contact.id,
        usedVehicleId: dto.usedVehicleId,
        source: dto.source ?? LeadSource.WEBSITE_FORM,
        stage: LeadStage.ENQUIRY,
      },
    });

    if (dto.message) {
      await this.prisma.crmActivity.create({
        data: { leadId: lead.id, contactId: contact.id, type: CrmActivityType.NOTE, notes: dto.message },
      });
    }

    return { contactId: contact.id, leadId: lead.id };
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

  /** Refuses to link an activity/task to a contact or lead belonging to another dealer. */
  private async verifyOwnership(dealerId: string, contactId?: string, leadId?: string) {
    if (contactId) {
      const contact = await this.prisma.contact.findFirst({ where: { id: contactId, dealerId } });
      if (!contact) {
        throw new NotFoundException('Contact not found');
      }
    }
    if (leadId) {
      const lead = await this.prisma.lead.findFirst({ where: { id: leadId, dealerId } });
      if (!lead) {
        throw new NotFoundException('Lead not found');
      }
    }
  }

  async createActivity(dealerId: string, dto: CreateActivityDto) {
    await this.verifyOwnership(dealerId, dto.contactId, dto.leadId);
    return this.prisma.crmActivity.create({ data: dto });
  }

  async createTask(dealerId: string, dto: CreateTaskDto) {
    await this.verifyOwnership(dealerId, dto.contactId, dto.leadId);
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

  async completeTask(dealerId: string, id: string) {
    const task = await this.prisma.crmTask.findFirst({
      where: { id, OR: [{ contact: { dealerId } }, { lead: { dealerId } }] },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
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

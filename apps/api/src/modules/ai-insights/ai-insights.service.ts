import { Injectable } from '@nestjs/common';
import { AiConversationChannel, AiMessageRole, JobCardStatus, LeadStage, UsedVehicleStatus } from '@project-amx/shared';
import { AiService } from '../../common/ai/ai.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VehicleValuationService } from '../../common/valuation/vehicle-valuation.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { ChatbotMessageDto, ChatMessageDto, EmailDraftDto, NlQueryDto } from './dto/ai.dto';

/**
 * Modules 14 & 15 — AI insights, natural-language reporting, lead scoring, and both the internal
 * assistant and the customer-facing chatbot. All calls go through the common AiService adapter
 * (Amazon Bedrock in production, a deterministic mock locally) so no live model access is
 * required to exercise these flows end-to-end.
 */
@Injectable()
export class AiInsightsService {
  constructor(
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
    private readonly valuationService: VehicleValuationService,
  ) {}

  /** §14.1 — AI-generated daily briefing built from the same KPIs as the Module 6 dashboard. */
  async dailyBriefing(dealerId: string) {
    const kpis = await this.dashboard.kpis(dealerId);
    const summary = await this.ai.complete({
      system:
        'You are the AMS dealership assistant. Write a short, plain-English morning briefing (3-4 bullet points) from the JSON KPI snapshot given, in the style of the example bullets in the AMS spec.',
      messages: [{ role: 'user', content: JSON.stringify(kpis) }],
      model: 'reasoning',
    });
    return { summary, kpis };
  }

  /** §14.2 — plain-English question in, structured answer out (mocked: no real NL→SQL translation). */
  async nlQuery(dealerId: string, dto: NlQueryDto) {
    const answer = await this.ai.complete({
      system: `You are answering operational questions for dealer ${dealerId} using AMS data. Explain what query you would run and give a plausible illustrative answer.`,
      messages: [{ role: 'user', content: dto.question }],
      model: 'reasoning',
    });
    return { question: dto.question, answer };
  }

  /** §14.3 — leads sorted by score, with the top 5 "priority calls for today". */
  async priorityLeads(dealerId: string) {
    const leads = await this.prisma.lead.findMany({
      where: { dealerId, stage: { notIn: [LeadStage.SOLD, LeadStage.LOST] } },
      include: { contact: true },
      orderBy: { lastActivityAt: 'asc' },
    });

    const scored = leads.map((lead) => {
      const daysSinceActivity = lead.lastActivityAt
        ? Math.floor((Date.now() - lead.lastActivityAt.getTime()) / 86400000)
        : 999;
      const score = Math.max(0, 100 - daysSinceActivity * 5);
      return { ...lead, score, reason: `${daysSinceActivity} day(s) since last activity` };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5);
  }

  /**
   * Predictive no-show risk for upcoming workshop bookings — the "AI-powered predictive
   * analytics" gap against Keyloop/Pinewood.AI, which both flag likely no-shows so a service
   * advisor can proactively confirm them. Deterministic and explainable rather than an LLM call
   * (matching priorityLeads' style), scored from signals actually on the booking: no phone
   * number to remind them with, no advisor assigned to own the confirmation call, booked far in
   * advance, or a thin record with no vehicle registration captured.
   */
  async serviceNoShowRisk(dealerId: string) {
    const bookings = await this.prisma.jobCard.findMany({
      where: { dealerId, status: JobCardStatus.SCHEDULED, scheduledStart: { gte: new Date() } },
      include: { contact: true },
      orderBy: { scheduledStart: 'asc' },
    });

    const scored = bookings.map((booking) => {
      const reasons: string[] = [];
      let score = 15;

      if (!booking.contact?.phone) {
        score += 30;
        reasons.push('no phone number on file to send a reminder');
      }
      if (!booking.serviceAdvisorId) {
        score += 20;
        reasons.push('no service advisor assigned to confirm it');
      }
      if (booking.scheduledStart) {
        const daysAhead = Math.ceil((booking.scheduledStart.getTime() - Date.now()) / 86400000);
        if (daysAhead > 14) {
          score += 20;
          reasons.push(`booked ${daysAhead} days in advance`);
        }
      }
      if (!booking.vehicleReg && !booking.vehicleId) {
        score += 15;
        reasons.push('no vehicle registration captured');
      }

      return { ...booking, riskScore: Math.min(100, score), reasons };
    });

    scored.sort((a, b) => b.riskScore - a.riskScore);
    return scored;
  }

  /**
   * Predictive/prescriptive used-car pricing suggestions — the "AI-powered analytics" gap
   * against Keyloop/Pinewood.AI's demand-based pricing tools. Flags stock that's both ageing and
   * priced meaningfully above the mocked market valuation (VehicleValuationService), so a
   * suggested price cut is surfaced proactively rather than discovered manually.
   */
  async usedCarPricingSuggestions(dealerId: string) {
    const vehicles = await this.prisma.usedVehicle.findMany({
      where: { dealerId, status: { in: [UsedVehicleStatus.IN_STOCK, UsedVehicleStatus.LISTED] }, askingPrice: { not: null } },
    });

    const now = Date.now();
    const suggestions = await Promise.all(
      vehicles.map(async (vehicle) => {
        const daysInStock = Math.floor((now - vehicle.createdAt.getTime()) / 86400000);
        const valuation = await this.valuationService.getValuation(vehicle.reg, vehicle.mileage ?? 0);
        const askingPrice = Number(vehicle.askingPrice);
        const overpricedBy = askingPrice - valuation.privateRetailValue;
        const overpricedPercent = overpricedBy / valuation.privateRetailValue;

        let recommendation: string | null = null;
        if (daysInStock > 60 && overpricedPercent > 0) {
          recommendation = `Priced above market and in stock ${daysInStock} days — suggest reducing to £${valuation.privateRetailValue}`;
        } else if (overpricedPercent > 0.05) {
          recommendation = `£${overpricedBy.toFixed(0)} above suggested market value — consider reducing to £${valuation.privateRetailValue}`;
        }

        return { vehicleId: vehicle.id, reg: vehicle.reg, askingPrice, daysInStock, valuation, recommendation };
      }),
    );

    return suggestions.filter((s) => s.recommendation).sort((a, b) => b.daysInStock - a.daysInStock);
  }

  /** §14.4 — contextual recommendation for a single lead. */
  async nextBestAction(dealerId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, dealerId },
      include: { contact: true, activities: true, usedVehicle: true },
    });
    if (!lead) {
      return { recommendation: 'Lead not found' };
    }
    const recommendation = await this.ai.complete({
      system: 'Recommend the single best next action for this sales lead in one sentence, in the style of the AMS spec examples.',
      messages: [{ role: 'user', content: JSON.stringify({ stage: lead.stage, activities: lead.activities.length, vehicle: lead.usedVehicle }) }],
      model: 'lightweight',
    });
    return { leadId, recommendation };
  }

  /** §14.5 — AI email drafting for the compose screen. */
  async draftEmail(dealerId: string, dto: EmailDraftDto) {
    const contact = await this.prisma.contact.findFirst({ where: { id: dto.contactId, dealerId } });
    const draft = await this.ai.complete({
      system: `Draft a ${dto.tone ?? 'Professional'} email for template category "${dto.templateCategory}".`,
      messages: [{ role: 'user', content: `Customer: ${contact?.firstName} ${contact?.lastName}` }],
      model: 'lightweight',
    });
    return { draft };
  }

  /** §14.6 — suggested slot for a new PDI/job based on capacity and skill match. */
  async workshopSuggestion(dealerId: string, jobType: string) {
    const bays = await this.prisma.bay.findMany({ where: { dealerId, active: true } });
    const suggestion = await this.ai.complete({
      system: 'Suggest the best bay and time slot today for this job type, given the available bays.',
      messages: [{ role: 'user', content: JSON.stringify({ jobType, bays: bays.map((b) => b.name) }) }],
      model: 'lightweight',
    });
    return { suggestion };
  }

  /** §14.7 — parts demand forecasting for the next 4 weeks. */
  async partsForecast(dealerId: string) {
    const parts = await this.prisma.part.findMany({ where: { dealerId } });
    const forecast = await this.ai.complete({
      system: 'Forecast likely 4-week demand per part from current stock levels and suggest proactive purchase orders.',
      messages: [{ role: 'user', content: JSON.stringify(parts.map((p) => ({ partNumber: p.partNumber, quantityOnHand: p.quantityOnHand }))) }],
      model: 'lightweight',
    });
    return { forecast };
  }

  /** §14.8 — persistent internal assistant chat. */
  async assistantChat(dealerId: string, userId: string, dto: ChatMessageDto) {
    const conversation = dto.conversationId
      ? await this.prisma.aiConversation.findUnique({ where: { id: dto.conversationId }, include: { messages: true } })
      : await this.prisma.aiConversation.create({
          data: { dealerId, channel: AiConversationChannel.INTERNAL_ASSISTANT, userId },
          include: { messages: true },
        });
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    await this.prisma.aiMessage.create({ data: { conversationId: conversation.id, role: AiMessageRole.USER, content: dto.message } });
    const reply = await this.ai.complete({
      system: 'You are the AMS internal assistant. Propose actions but do not execute them without confirmation.',
      messages: [...conversation.messages.map((m) => ({ role: m.role === 'USER' ? ('user' as const) : ('assistant' as const), content: m.content })), { role: 'user', content: dto.message }],
      model: 'reasoning',
    });
    await this.prisma.aiMessage.create({ data: { conversationId: conversation.id, role: AiMessageRole.ASSISTANT, content: reply } });

    return { conversationId: conversation.id, reply };
  }

  /** Module 15 — customer-facing chatbot; creates a CRM lead on first message per dealer. */
  async chatbotMessage(dealerId: string, dto: ChatbotMessageDto) {
    let conversation = dto.conversationId
      ? await this.prisma.aiConversation.findUnique({ where: { id: dto.conversationId }, include: { messages: true } })
      : null;

    if (!conversation) {
      conversation = await this.prisma.aiConversation.create({
        data: { dealerId, channel: AiConversationChannel.CUSTOMER_CHATBOT },
        include: { messages: true },
      });

      if (dto.customerEmail) {
        const contact = await this.prisma.contact.create({
          data: { dealerId, firstName: dto.customerName ?? 'Website', lastName: 'Visitor', email: dto.customerEmail },
        });
        await this.prisma.lead.create({ data: { dealerId, contactId: contact.id, source: 'CHATBOT' } });
      }
    }

    await this.prisma.aiMessage.create({ data: { conversationId: conversation.id, role: AiMessageRole.USER, content: dto.message } });
    const reply = await this.ai.complete({
      system: 'You are a friendly dealership website chatbot. Help with vehicle enquiries, stock search, and service bookings.',
      messages: [{ role: 'user', content: dto.message }],
      model: 'lightweight',
    });
    await this.prisma.aiMessage.create({ data: { conversationId: conversation.id, role: AiMessageRole.ASSISTANT, content: reply } });

    return { conversationId: conversation.id, reply };
  }
}

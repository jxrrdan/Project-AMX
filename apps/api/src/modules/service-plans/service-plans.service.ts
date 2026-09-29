import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EmailService } from '../../common/email/email.service';
import { SmsService } from '../../common/sms/sms.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateServicePlanDto,
  CreateSubscriptionDto,
  UpdateServicePlanDto,
  UpdateSubscriptionDto,
} from './dto/service-plan.dto';

const DAY_MS = 86_400_000;

/**
 * Service plans & reminders (#3) — service-plan products, customer/vehicle subscriptions carrying
 * MOT and service due dates, and an automated reminder sweep that emails/SMSes customers as those
 * dates approach (stamping *ReminderSentAt so each fires once per due window). This is the biggest
 * recurring-revenue lever in aftersales.
 */
@Injectable()
export class ServicePlansService {
  private readonly logger = new Logger(ServicePlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  // --- Plans ----------------------------------------------------------------

  listPlans(dealerId: string) {
    return this.prisma.servicePlan.findMany({
      where: { dealerId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  createPlan(dealerId: string, dto: CreateServicePlanDto) {
    return this.prisma.servicePlan.create({
      data: {
        dealerId,
        name: dto.name,
        description: dto.description,
        priceMonthly: dto.priceMonthly ?? 0,
        intervalMonths: dto.intervalMonths ?? 12,
      },
    });
  }

  async updatePlan(dealerId: string, id: string, dto: UpdateServicePlanDto) {
    const plan = await this.prisma.servicePlan.findFirst({ where: { id, dealerId } });
    if (!plan) {
      throw new NotFoundException('Service plan not found');
    }
    return this.prisma.servicePlan.update({ where: { id }, data: dto });
  }

  // --- Subscriptions --------------------------------------------------------

  listSubscriptions(dealerId: string) {
    return this.prisma.servicePlanSubscription.findMany({
      where: { dealerId },
      include: { plan: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSubscription(dealerId: string, dto: CreateSubscriptionDto) {
    const plan = await this.prisma.servicePlan.findFirst({ where: { id: dto.planId, dealerId } });
    if (!plan) {
      throw new NotFoundException('Service plan not found');
    }
    return this.prisma.servicePlanSubscription.create({
      data: {
        dealerId,
        planId: dto.planId,
        customerName: dto.customerName,
        vehicleReg: dto.vehicleReg,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        motDueDate: dto.motDueDate ? new Date(dto.motDueDate) : undefined,
        serviceDueDate: dto.serviceDueDate ? new Date(dto.serviceDueDate) : undefined,
      },
    });
  }

  async updateSubscription(dealerId: string, id: string, dto: UpdateSubscriptionDto) {
    const sub = await this.prisma.servicePlanSubscription.findFirst({ where: { id, dealerId } });
    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }
    // Changing a due date clears its reminder stamp so a fresh reminder can fire for the new window.
    return this.prisma.servicePlanSubscription.update({
      where: { id },
      data: {
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        active: dto.active,
        motDueDate: dto.motDueDate ? new Date(dto.motDueDate) : undefined,
        serviceDueDate: dto.serviceDueDate ? new Date(dto.serviceDueDate) : undefined,
        motReminderSentAt: dto.motDueDate ? null : undefined,
        serviceReminderSentAt: dto.serviceDueDate ? null : undefined,
      },
    });
  }

  /** How many MOT/service reminders are due within the window (for the module's headline figures). */
  async dueSummary(dealerId: string, withinDays = 30) {
    const cutoff = new Date(Date.now() + withinDays * DAY_MS);
    const [motDue, serviceDue] = await Promise.all([
      this.prisma.servicePlanSubscription.count({
        where: { dealerId, active: true, motReminderSentAt: null, motDueDate: { not: null, lte: cutoff } },
      }),
      this.prisma.servicePlanSubscription.count({
        where: { dealerId, active: true, serviceReminderSentAt: null, serviceDueDate: { not: null, lte: cutoff } },
      }),
    ]);
    return { motDue, serviceDue };
  }

  /**
   * Send any MOT/service reminders now due within the window and stamp them so they don't re-fire.
   * Exposed as a "Run now" action; a scheduled job could call the same method nightly.
   */
  async runDueReminders(dealerId: string, withinDays = 30) {
    const cutoff = new Date(Date.now() + withinDays * DAY_MS);
    const subs = await this.prisma.servicePlanSubscription.findMany({
      where: {
        dealerId,
        active: true,
        OR: [
          { motReminderSentAt: null, motDueDate: { not: null, lte: cutoff } },
          { serviceReminderSentAt: null, serviceDueDate: { not: null, lte: cutoff } },
        ],
      },
    });

    let motSent = 0;
    let serviceSent = 0;
    for (const sub of subs) {
      if (sub.motDueDate && !sub.motReminderSentAt && sub.motDueDate <= cutoff) {
        await this.notify(sub, 'MOT', sub.motDueDate);
        await this.prisma.servicePlanSubscription.update({ where: { id: sub.id }, data: { motReminderSentAt: new Date() } });
        motSent++;
      }
      if (sub.serviceDueDate && !sub.serviceReminderSentAt && sub.serviceDueDate <= cutoff) {
        await this.notify(sub, 'Service', sub.serviceDueDate);
        await this.prisma.servicePlanSubscription.update({ where: { id: sub.id }, data: { serviceReminderSentAt: new Date() } });
        serviceSent++;
      }
    }
    return { motSent, serviceSent, total: motSent + serviceSent };
  }

  private async notify(
    sub: { customerName: string; vehicleReg: string; contactEmail: string | null; contactPhone: string | null },
    kind: string,
    dueDate: Date,
  ) {
    const due = dueDate.toLocaleDateString('en-GB');
    const subject = `${kind} due for ${sub.vehicleReg}`;
    const message = `Hi ${sub.customerName}, your ${kind.toLowerCase()} for ${sub.vehicleReg} is due on ${due}. Please contact us to book.`;
    try {
      if (sub.contactEmail) {
        await this.email.send({ to: sub.contactEmail, subject, html: `<p>${message}</p>` });
      }
      if (sub.contactPhone) {
        await this.sms.send(sub.contactPhone, message);
      }
    } catch (err) {
      // Console adapters don't fail locally, but a real SES/Twilio outage must not wedge the sweep.
      this.logger.warn(`Failed to send ${kind} reminder for ${sub.vehicleReg}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

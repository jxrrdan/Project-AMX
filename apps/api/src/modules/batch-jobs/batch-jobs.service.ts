import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BatchJobName, BatchJobStatus, LeadStage, NotificationChannel, SystemRole } from '@project-amx/shared';
import { addDays, subDays } from 'date-fns';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Scheduled maintenance jobs that don't belong to any one module's request/response cycle —
 * things that should happen "every night" or "on the 1st of the month" regardless of whether
 * anyone is looking at the app. Each job runs once per dealer (never cross-tenant) and writes a
 * BatchJobRun row so there's a visible audit trail (Settings > Batch jobs), the same "run log"
 * pattern already used for OEM integration connectors.
 */
@Injectable()
export class BatchJobsService {
  private readonly logger = new Logger(BatchJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 2 * * *')
  async nightlyStaleLeadEscalation(): Promise<void> {
    await this.runForAllDealers(BatchJobName.STALE_LEAD_ESCALATION, (dealerId) => this.staleLeadEscalation(dealerId));
  }

  @Cron('15 2 * * *')
  async nightlyPartsReorderAlert(): Promise<void> {
    await this.runForAllDealers(BatchJobName.PARTS_REORDER_ALERT, (dealerId) => this.partsReorderAlert(dealerId));
  }

  @Cron('0 3 1 * *')
  async monthlyCourtesyFleetExpirySweep(): Promise<void> {
    await this.runForAllDealers(BatchJobName.COURTESY_FLEET_EXPIRY_SWEEP, (dealerId) => this.courtesyFleetExpirySweep(dealerId));
  }

  /** Manual "run now" — lets a job be tested/demonstrated without waiting for its schedule. */
  async runNow(dealerId: string, jobName: BatchJobName) {
    const job = this.jobs[jobName];
    if (!job) {
      throw new BadRequestException(`Unknown batch job "${jobName}"`);
    }
    return this.runJob(dealerId, jobName, () => job(dealerId));
  }

  listRuns(dealerId: string) {
    return this.prisma.batchJobRun.findMany({ where: { dealerId }, orderBy: { startedAt: 'desc' }, take: 50 });
  }

  private readonly jobs: Record<BatchJobName, (dealerId: string) => Promise<string>> = {
    [BatchJobName.STALE_LEAD_ESCALATION]: (dealerId) => this.staleLeadEscalation(dealerId),
    [BatchJobName.PARTS_REORDER_ALERT]: (dealerId) => this.partsReorderAlert(dealerId),
    [BatchJobName.COURTESY_FLEET_EXPIRY_SWEEP]: (dealerId) => this.courtesyFleetExpirySweep(dealerId),
  };

  private async runForAllDealers(jobName: BatchJobName, fn: (dealerId: string) => Promise<string>): Promise<void> {
    const dealers = await this.prisma.dealer.findMany({ select: { id: true } });
    for (const { id: dealerId } of dealers) {
      await this.runJob(dealerId, jobName, () => fn(dealerId));
    }
  }

  private async runJob(dealerId: string, jobName: BatchJobName, fn: () => Promise<string>) {
    const run = await this.prisma.batchJobRun.create({ data: { dealerId, jobName, status: BatchJobStatus.RUNNING } });
    try {
      const summary = await fn();
      return this.prisma.batchJobRun.update({
        where: { id: run.id },
        data: { status: BatchJobStatus.SUCCESS, summary, finishedAt: new Date() },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Batch job ${jobName} failed for dealer ${dealerId}: ${errorMessage}`);
      return this.prisma.batchJobRun.update({
        where: { id: run.id },
        data: { status: BatchJobStatus.ERROR, errorMessage, finishedAt: new Date() },
      });
    }
  }

  /** Open leads with no activity in 7+ days — nudges the assigned salesperson before it goes cold. */
  private async staleLeadEscalation(dealerId: string): Promise<string> {
    const cutoff = subDays(new Date(), 7);
    const staleLeads = await this.prisma.lead.findMany({
      where: {
        dealerId,
        stage: { notIn: [LeadStage.SOLD, LeadStage.LOST] },
        lastActivityAt: { lte: cutoff },
        assignedSalespersonId: { not: null },
      },
      include: { contact: true },
    });

    for (const lead of staleLeads) {
      // SMS, not just in-app — a lead going cold is time-sensitive enough to interrupt the
      // salesperson directly (falls back to an in-app-only notification if they have no phone
      // number on file — see NotificationsService.deliver).
      await this.notifications.create(
        dealerId,
        lead.assignedSalespersonId as string,
        'STALE_LEAD',
        'Stale lead needs attention',
        `${lead.contact.firstName} ${lead.contact.lastName} has had no activity in 7+ days (stage: ${lead.stage}).`,
        NotificationChannel.SMS,
      );
    }
    return `${staleLeads.length} stale lead(s) flagged`;
  }

  /** Parts at or below their reorder level — notifies whoever holds the Parts Manager role. */
  private async partsReorderAlert(dealerId: string): Promise<string> {
    const parts = await this.prisma.part.findMany({ where: { dealerId } });
    const lowStock = parts.filter((p) => p.quantityOnHand <= p.reorderLevel);
    if (!lowStock.length) {
      return 'No parts at or below their reorder level';
    }

    const partsManagers = await this.prisma.user.findMany({
      where: { dealerId, active: true, roles: { some: { role: { systemRole: SystemRole.PARTS_MANAGER } } } },
    });
    const partNumbers = lowStock.slice(0, 5).map((p) => p.partNumber).join(', ');
    const suffix = lowStock.length > 5 ? '…' : '';
    await this.notifications.createMany(
      dealerId,
      partsManagers.map((u) => u.id),
      'PARTS_REORDER',
      'Parts below reorder level',
      `${lowStock.length} part(s) at or below reorder level: ${partNumbers}${suffix}`,
    );
    return `${lowStock.length} part(s) at/below reorder level; notified ${partsManagers.length} parts manager(s)`;
  }

  /** Courtesy fleet vehicles due for MOT/insurance/tax renewal within 30 days. */
  private async courtesyFleetExpirySweep(dealerId: string): Promise<string> {
    const cutoff = addDays(new Date(), 30);
    const vehicles = await this.prisma.courtesyVehicle.findMany({ where: { dealerId } });
    const expiring = vehicles.filter(
      (v) =>
        (v.insuranceExpiry && v.insuranceExpiry <= cutoff) ||
        (v.motExpiry && v.motExpiry <= cutoff) ||
        (v.taxExpiry && v.taxExpiry <= cutoff),
    );
    if (!expiring.length) {
      return 'No courtesy vehicles due for renewal within 30 days';
    }

    const managers = await this.prisma.user.findMany({
      where: {
        dealerId,
        active: true,
        roles: { some: { role: { systemRole: { in: [SystemRole.GENERAL_MANAGER, SystemRole.DEALER_PRINCIPAL] } } } },
      },
    });
    // Email, not just in-app — a monthly digest a GM is more likely to actually read from their inbox.
    await this.notifications.createMany(
      dealerId,
      managers.map((u) => u.id),
      'COURTESY_FLEET_EXPIRY',
      'Courtesy vehicles due for renewal',
      `${expiring.length} courtesy vehicle(s) due MOT/insurance/tax renewal within 30 days.`,
      NotificationChannel.EMAIL,
    );
    return `${expiring.length} courtesy vehicle(s) due for renewal; notified ${managers.length} manager(s)`;
  }
}

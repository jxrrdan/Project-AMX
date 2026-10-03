import { Injectable } from '@nestjs/common';
import { BackorderStatus, CreditNoteStatus, PaymentKind, RecallVehicleStatus } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

const DAY_MS = 86_400_000;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Management reporting (#6) — a Daily Operating Control (DOC): a single composite snapshot of the
 * business across sales, aftersales, parts, and finance, the report a dealer principal reads each
 * morning. Built from live aggregates across the modules rather than a warehoused copy.
 */
@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async doc(dealerId: string) {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const reminderCutoff = new Date(Date.now() + 30 * DAY_MS);

    const [
      pipelineTotal,
      pipelineDelivered,
      usedStock,
      openJobCards,
      parts,
      backorders,
      paymentsToday,
      debtors,
      creditNotes,
      recallsOutstanding,
      motDue,
      serviceDue,
    ] = await Promise.all([
      this.prisma.vehicle.count({ where: { dealerId } }),
      this.prisma.vehicle.count({ where: { dealerId, status: 'DELIVERED' } }),
      this.prisma.usedVehicle.count({ where: { dealerId } }),
      this.prisma.jobCard.count({ where: { dealerId, status: { notIn: ['COMPLETE', 'INVOICED'] } } }),
      this.prisma.part.findMany({ where: { dealerId }, select: { quantityOnHand: true, costPrice: true } }),
      this.prisma.partBackorder.count({ where: { dealerId, status: BackorderStatus.OUTSTANDING } }),
      this.prisma.payment.findMany({ where: { dealerId, receivedAt: { gte: dayStart } }, select: { amount: true, kind: true } }),
      this.prisma.accountCustomer.aggregate({ where: { dealerId, balance: { gt: 0 } }, _sum: { balance: true } }),
      this.prisma.creditNote.aggregate({ where: { dealerId, status: CreditNoteStatus.ISSUED }, _sum: { total: true }, _count: true }),
      this.prisma.recallVehicle.count({ where: { dealerId, status: RecallVehicleStatus.OUTSTANDING } }),
      this.prisma.servicePlanSubscription.count({
        where: { dealerId, active: true, motReminderSentAt: null, motDueDate: { not: null, lte: reminderCutoff } },
      }),
      this.prisma.servicePlanSubscription.count({
        where: { dealerId, active: true, serviceReminderSentAt: null, serviceDueDate: { not: null, lte: reminderCutoff } },
      }),
    ]);

    const partsStockValue = round2(parts.reduce((sum, p) => sum + p.quantityOnHand * Number(p.costPrice), 0));
    const cashToday = round2(
      paymentsToday.reduce((sum, p) => sum + (p.kind === PaymentKind.REFUND ? -Number(p.amount) : Number(p.amount)), 0),
    );

    return {
      generatedAt: now,
      sales: {
        pipeline: pipelineTotal,
        delivered: pipelineDelivered,
        inProgress: pipelineTotal - pipelineDelivered,
        usedStock,
      },
      aftersales: {
        openJobCards,
        recallsOutstanding,
        motRemindersDue: motDue,
        serviceRemindersDue: serviceDue,
      },
      parts: {
        stockValue: partsStockValue,
        backordersOutstanding: backorders,
      },
      finance: {
        cashTakenToday: cashToday,
        agedDebtorsTotal: round2(Number(debtors._sum.balance ?? 0)),
        creditNotesIssued: creditNotes._count,
        creditNotesIssuedValue: round2(Number(creditNotes._sum.total ?? 0)),
      },
    };
  }
}

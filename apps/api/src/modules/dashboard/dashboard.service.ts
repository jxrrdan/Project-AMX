import { Injectable } from '@nestjs/common';
import { JobCardStatus, LeadStage, PdiStatus, WarrantyClaimStatus } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Module 6 — single-screen KPI overview across every module (§6.1). */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async kpis(dealerId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [
      pdisToday,
      pdisCompleteToday,
      bays,
      capacityToday,
      jobCardsToday,
      usedInStock,
      usedSoldMtd,
      leads,
      lowStockParts,
      openWarrantyClaims,
      claimsAwaitingAuth,
    ] = await Promise.all([
      this.prisma.pdiJob.count({ where: { dealerId, scheduledDate: { gte: startOfToday } } }),
      this.prisma.pdiJob.count({ where: { dealerId, status: PdiStatus.COMPLETE, scheduledDate: { gte: startOfToday } } }),
      this.prisma.bay.count({ where: { dealerId, active: true } }),
      this.prisma.capacityBlock.findMany({ where: { dealerId, date: startOfToday } }),
      this.prisma.jobCard.findMany({ where: { dealerId, scheduledStart: { gte: startOfToday } } }),
      this.prisma.usedVehicle.count({ where: { dealerId, status: 'IN_STOCK' } }),
      this.prisma.usedVehicle.count({ where: { dealerId, status: 'SOLD', soldAt: { gte: startOfMonth } } }),
      this.prisma.lead.findMany({ where: { dealerId } }),
      this.prisma.part.findMany({ where: { dealerId } }),
      this.prisma.warrantyClaim.count({ where: { dealerId, status: { notIn: [WarrantyClaimStatus.PAID, WarrantyClaimStatus.REJECTED] } } }),
      this.prisma.warrantyClaim.count({ where: { dealerId, status: WarrantyClaimStatus.SUBMITTED } }),
    ]);

    const availableMinutes = capacityToday.reduce((sum, c) => sum + c.availableMinutes, 0) || bays * 480;
    const bookedHours = jobCardsToday.reduce((sum, j) => sum + Number(j.estimatedHours), 0);
    const openLeads = leads.filter((l) => ![LeadStage.SOLD, LeadStage.LOST].includes(l.stage as LeadStage));
    const leadsByStage = leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.stage] = (acc[l.stage] ?? 0) + 1;
      return acc;
    }, {});
    const soldThisMonth = leads.filter((l) => l.stage === LeadStage.SOLD).length;

    return {
      pdi: { scheduled: pdisToday, complete: pdisCompleteToday },
      workshop: {
        utilisationPct: availableMinutes ? Math.min(100, Math.round(((bookedHours * 60) / availableMinutes) * 100)) : 0,
        jobsToday: jobCardsToday.length,
        completeToday: jobCardsToday.filter((j) => j.status === JobCardStatus.COMPLETE).length,
      },
      usedCars: { inStock: usedInStock, soldMtd: usedSoldMtd },
      crm: { openLeads: openLeads.length, leadsByStage, conversionRateMtd: leads.length ? soldThisMonth / leads.length : 0 },
      parts: { belowReorderLevel: lowStockParts.filter((p) => p.quantityOnHand <= p.reorderLevel).length },
      warranty: { openClaims: openWarrantyClaims, awaitingAuthorisation: claimsAwaitingAuth },
    };
  }
}

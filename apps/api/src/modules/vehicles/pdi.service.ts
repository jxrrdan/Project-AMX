import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, PdiStatus, VehiclePipelineStatus } from '@project-amx/shared';
import { AuditService } from '../../common/audit/audit.service';
import { PdfService } from '../../common/pdf/pdf.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SchedulePdiDto, SignOffPdiDto, UpdateChecklistItemDto } from './dto/pdi.dto';
import { DEFAULT_PDI_CHECKLIST } from './pdi-checklist.template';

const PDI_PDF_TEMPLATE = `
<html><body style="font-family: sans-serif;">
<h1>PDI Checklist — {{vehicle.model}} ({{vehicle.vin}})</h1>
<p>Signed off by: {{signedOffBy}} on {{signedOffAt}}</p>
<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
<tr><th>Category</th><th>Item</th><th>Rating</th><th>Notes</th></tr>
{{#each items}}
<tr><td>{{category}}</td><td>{{label}}</td><td>{{rating}}</td><td>{{notes}}</td></tr>
{{/each}}
</table>
</body></html>`;

@Injectable()
export class PdiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pdf: PdfService,
  ) {}

  /** PDI Scheduling (Feature Spec §1.3) — only vehicles marked Arrived may be scheduled. */
  async schedule(dealerId: string, vehicleId: string, dto: SchedulePdiDto, actingUserId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, dealerId } });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    if (vehicle.status !== VehiclePipelineStatus.ARRIVED) {
      throw new BadRequestException('PDI can only be scheduled once the vehicle has arrived');
    }

    const pdiJob = await this.prisma.$transaction(async (tx) => {
      const job = await tx.pdiJob.create({
        data: {
          dealerId,
          vehicleId,
          scheduledDate: new Date(dto.scheduledDate),
          bayId: dto.bayId,
          technicianId: dto.technicianId,
          estimatedMinutes: dto.estimatedMinutes ?? 60,
          // AWP integration: a real deployment posts this job card to AWP and stores the returned
          // reference (Feature Spec §1.3) — mocked here with a locally generated reference.
          awpJobRef: `AWP-MOCK-${Date.now()}`,
          checklistItems: {
            create: DEFAULT_PDI_CHECKLIST.map((item, index) => ({
              category: item.category,
              label: item.label,
              sortOrder: index,
            })),
          },
        },
        include: { checklistItems: true },
      });
      await tx.vehicle.update({ where: { id: vehicleId }, data: { status: VehiclePipelineStatus.PDI_SCHEDULED } });
      return job;
    });

    await this.audit.record({
      dealerId,
      userId: actingUserId,
      module: ModuleKey.NEW_CAR_PDI,
      action: 'pdi.schedule',
      recordType: 'PdiJob',
      recordId: pdiJob.id,
      after: pdiJob,
    });

    return pdiJob;
  }

  async updateChecklistItem(dealerId: string, itemId: string, dto: UpdateChecklistItemDto) {
    const item = await this.prisma.pdiChecklistItem.findFirst({
      where: { id: itemId, pdiJob: { dealerId } },
    });
    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }
    return this.prisma.pdiChecklistItem.update({
      where: { id: itemId },
      data: { rating: dto.rating, notes: dto.notes, photoUrls: dto.photoUrls ?? [] },
    });
  }

  /** Mandatory sign-off before status advances to PDI Complete (Feature Spec §1.4). */
  async signOff(dealerId: string, pdiJobId: string, dto: SignOffPdiDto, actingUserId: string) {
    const pdiJob = await this.prisma.pdiJob.findFirst({
      where: { id: pdiJobId, dealerId },
      include: { checklistItems: true, vehicle: true },
    });
    if (!pdiJob) {
      throw new NotFoundException('PDI job not found');
    }
    const incomplete = pdiJob.checklistItems.filter((item) => !item.rating);
    if (incomplete.length > 0) {
      throw new BadRequestException(`${incomplete.length} checklist item(s) are not yet rated`);
    }

    const signedOffAt = new Date();
    const checklistPdfUrl = await this.pdf.renderAndStore(
      dealerId,
      'pdi-checklists',
      `pdi-${pdiJobId}`,
      PDI_PDF_TEMPLATE,
      {
        vehicle: pdiJob.vehicle,
        signedOffBy: dto.signedOffBy,
        signedOffAt: signedOffAt.toISOString(),
        items: pdiJob.checklistItems,
      },
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const job = await tx.pdiJob.update({
        where: { id: pdiJobId },
        data: { status: PdiStatus.COMPLETE, signedOffAt, signedOffBy: dto.signedOffBy, checklistPdfUrl },
      });
      await tx.vehicle.update({
        where: { id: pdiJob.vehicleId },
        data: { status: VehiclePipelineStatus.PDI_COMPLETE },
      });
      return job;
    });

    await this.audit.record({
      dealerId,
      userId: actingUserId,
      module: ModuleKey.NEW_CAR_PDI,
      action: 'pdi.sign_off',
      recordType: 'PdiJob',
      recordId: pdiJobId,
      after: updated,
    });

    return updated;
  }
}

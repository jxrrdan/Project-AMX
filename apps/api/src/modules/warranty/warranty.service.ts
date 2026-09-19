import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { WarrantyClaimStatus } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateOperationLineDto,
  CreateWarrantyClaimDto,
  UpdateClaimStatusDto,
  UpdateOperationLineDto,
} from './dto/warranty.dto';

/** Module 5 — multi-line warranty jobs with per-line technician clocking and the mandatory 3Cs (§5.1-5.4). */
@Injectable()
export class WarrantyService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(dealerId: string, status?: WarrantyClaimStatus) {
    return this.prisma.warrantyClaim.findMany({
      where: { dealerId, status: status || undefined },
      include: { vehicle: true, operationLines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(dealerId: string, id: string) {
    return this.prisma.warrantyClaim.findFirst({
      where: { id, dealerId },
      include: { vehicle: true, operationLines: { include: { clockEntries: true } } },
    });
  }

  create(dealerId: string, dto: CreateWarrantyClaimDto) {
    return this.prisma.warrantyClaim.create({ data: { dealerId, ...dto } });
  }

  async addOperationLine(dealerId: string, warrantyClaimId: string, dto: CreateOperationLineDto) {
    const claim = await this.prisma.warrantyClaim.findFirst({ where: { id: warrantyClaimId, dealerId } });
    if (!claim) {
      throw new NotFoundException('Warranty claim not found');
    }
    return this.prisma.warrantyOperationLine.create({ data: { warrantyClaimId, ...dto } });
  }

  async updateOperationLine(dealerId: string, lineId: string, dto: UpdateOperationLineDto) {
    const line = await this.prisma.warrantyOperationLine.findFirst({
      where: { id: lineId, warrantyClaim: { dealerId } },
    });
    if (!line) {
      throw new NotFoundException('Operation line not found');
    }
    return this.prisma.warrantyOperationLine.update({ where: { id: lineId }, data: dto });
  }

  /** Technician clocks on/off per line independently; multiple cycles supported (§5.2). */
  async clockOn(dealerId: string, lineId: string, technicianId: string) {
    const line = await this.prisma.warrantyOperationLine.findFirst({
      where: { id: lineId, warrantyClaim: { dealerId } },
    });
    if (!line) {
      throw new NotFoundException('Operation line not found');
    }
    return this.prisma.warrantyClockEntry.create({ data: { lineId, technicianId, clockOn: new Date() } });
  }

  async clockOff(dealerId: string, lineId: string, technicianId: string) {
    const line = await this.prisma.warrantyOperationLine.findFirst({
      where: { id: lineId, warrantyClaim: { dealerId } },
    });
    if (!line) {
      throw new NotFoundException('Operation line not found');
    }
    const open = await this.prisma.warrantyClockEntry.findFirst({
      where: { lineId, technicianId, clockOff: null },
      orderBy: { clockOn: 'desc' },
    });
    if (!open) {
      throw new NotFoundException('No open clocking found for this technician on this line');
    }
    return this.prisma.warrantyClockEntry.update({ where: { id: open.id }, data: { clockOff: new Date() } });
  }

  /** Supervisor reviews and approves each line before the claim can be submitted (§5.2). */
  async approveLine(dealerId: string, lineId: string, approvedBy: string) {
    const line = await this.prisma.warrantyOperationLine.findFirst({
      where: { id: lineId, warrantyClaim: { dealerId } },
    });
    if (!line) {
      throw new NotFoundException('Operation line not found');
    }
    return this.prisma.warrantyOperationLine.update({
      where: { id: lineId },
      data: { approvedAt: new Date(), approvedBy },
    });
  }

  /** Claim status workflow: Draft → Submitted → Authorised → Rejected → Paid (§5.4). */
  async updateStatus(dealerId: string, id: string, dto: UpdateClaimStatusDto) {
    const claim = await this.prisma.warrantyClaim.findFirst({
      where: { id, dealerId },
      include: { operationLines: true },
    });
    if (!claim) {
      throw new NotFoundException('Warranty claim not found');
    }

    if (dto.status === WarrantyClaimStatus.SUBMITTED) {
      const unapproved = claim.operationLines.filter((l) => !l.approvedAt);
      if (unapproved.length > 0) {
        throw new BadRequestException('All operation lines must be approved before submission');
      }
      const missingWriteUp = claim.operationLines.filter((l) => !l.labourWriteUp || !l.cause || !l.correction || !l.complaint);
      if (missingWriteUp.length > 0) {
        throw new BadRequestException('Every line needs a labour write-up and the 3Cs (Cause, Correction, Complaint) before submission');
      }
    }

    return this.prisma.warrantyClaim.update({
      where: { id },
      data: { status: dto.status, rejectionReason: dto.rejectionReason, actualPayment: dto.actualPayment },
    });
  }

  // --- Reporting (§5.5) -----------------------------------------------------

  async rejectionRateReport(dealerId: string) {
    const claims = await this.prisma.warrantyClaim.findMany({ where: { dealerId } });
    const rejected = claims.filter((c) => c.status === WarrantyClaimStatus.REJECTED);
    return {
      total: claims.length,
      rejected: rejected.length,
      rejectionRate: claims.length ? rejected.length / claims.length : 0,
    };
  }
}

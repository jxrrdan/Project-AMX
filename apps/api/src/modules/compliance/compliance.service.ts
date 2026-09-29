import { Injectable } from '@nestjs/common';
import { ConsentType } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateConsentDto, CreateSignatureDto } from './dto/compliance.dto';

/**
 * Compliance & e-signature (#7) — auditable GDPR/FCA consent capture (Consumer Duty, IDD for
 * finance, marketing preferences) and captured e-signatures against documents. Both are
 * append-only audit records: who consented/signed what, when, and (for signatures) from where.
 */
@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  listConsents(dealerId: string, consentType?: ConsentType) {
    return this.prisma.consentRecord.findMany({
      where: { dealerId, consentType: consentType || undefined },
      orderBy: { capturedAt: 'desc' },
      take: 200,
    });
  }

  createConsent(dealerId: string, dto: CreateConsentDto, capturedBy: string) {
    return this.prisma.consentRecord.create({
      data: {
        dealerId,
        customerName: dto.customerName,
        contactRef: dto.contactRef,
        consentType: dto.consentType,
        granted: dto.granted,
        notes: dto.notes,
        capturedBy,
      },
    });
  }

  listSignatures(dealerId: string) {
    return this.prisma.documentSignature.findMany({
      where: { dealerId },
      orderBy: { signedAt: 'desc' },
      take: 200,
    });
  }

  createSignature(dealerId: string, dto: CreateSignatureDto, ipAddress?: string) {
    return this.prisma.documentSignature.create({
      data: {
        dealerId,
        documentType: dto.documentType,
        documentRef: dto.documentRef,
        signerName: dto.signerName,
        signatureData: dto.signatureData,
        ipAddress,
      },
    });
  }
}

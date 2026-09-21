import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateDocumentSequenceDto } from './dto/dealer.dto';

/** docType keys used across document numbering — kept as plain strings (not an enum) so a dealer
 * can eventually define their own without a schema migration; DEFAULT_PREFIXES seeds the common ones. */
const DEFAULT_PREFIXES: Record<string, string> = {
  DEAL_SHEET: 'DS',
  SALES_INVOICE: 'INV',
  PART_EXCHANGE_RECEIPT: 'PX',
  SERVICE_ESTIMATE: 'EST',
  HANDOVER_DOCUMENT: 'HO',
};

/**
 * Per-dealer document numbering (master data, Settings > Document numbering) — e.g. deal sheets
 * get "DS-2026-00001", incrementing per dealer per doc type per calendar year. Rows are created
 * lazily on first use/view rather than seeded, so a dealer's numbering only starts once they
 * actually touch that document type.
 */
@Injectable()
export class DocumentSequenceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dealerId: string) {
    const year = new Date().getFullYear();
    await Promise.all(Object.keys(DEFAULT_PREFIXES).map((docType) => this.ensureRow(dealerId, docType, year)));
    return this.prisma.documentSequence.findMany({ where: { dealerId, year }, orderBy: { docType: 'asc' } });
  }

  async update(dealerId: string, id: string, dto: UpdateDocumentSequenceDto) {
    const existing = await this.prisma.documentSequence.findFirst({ where: { id, dealerId } });
    if (!existing) {
      throw new NotFoundException('Document sequence not found');
    }
    return this.prisma.documentSequence.update({ where: { id }, data: dto });
  }

  /** Atomically reserves and returns the next formatted document number, e.g. "DS-2026-00001". */
  async nextNumber(dealerId: string, docType: string): Promise<string> {
    const year = new Date().getFullYear();
    return this.prisma.$transaction(async (tx) => {
      const seq = await tx.documentSequence.upsert({
        where: { dealerId_docType_year: { dealerId, docType, year } },
        update: {},
        create: { dealerId, docType, year, prefix: DEFAULT_PREFIXES[docType] ?? docType.slice(0, 3).toUpperCase(), nextNumber: 1 },
      });
      await tx.documentSequence.update({ where: { id: seq.id }, data: { nextNumber: { increment: 1 } } });
      return `${seq.prefix}-${year}-${String(seq.nextNumber).padStart(5, '0')}`;
    });
  }

  private async ensureRow(dealerId: string, docType: string, year: number) {
    await this.prisma.documentSequence.upsert({
      where: { dealerId_docType_year: { dealerId, docType, year } },
      update: {},
      create: { dealerId, docType, year, prefix: DEFAULT_PREFIXES[docType] ?? docType.slice(0, 3).toUpperCase(), nextNumber: 1 },
    });
  }
}

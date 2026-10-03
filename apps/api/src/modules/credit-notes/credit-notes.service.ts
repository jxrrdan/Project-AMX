import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreditNoteStatus } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DocumentSequenceService } from '../dealers/document-sequence.service';
import { CreateCreditNoteDto, CreditNoteLineDto, UpdateCreditNoteDto } from './dto/credit-note.dto';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Credit Notes — refunds/adjustments raised against a customer (goodwill credit, overcharge
 * correction, returned-part refund). A note is editable while DRAFT, gets a document number on
 * ISSUE (via the shared DocumentSequenceService, e.g. "CN-2026-00001"), then can be APPLIED
 * against a balance or CANCELLED.
 */
@Injectable()
export class CreditNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: DocumentSequenceService,
  ) {}

  findAll(dealerId: string, status?: CreditNoteStatus) {
    return this.prisma.creditNote.findMany({
      where: { dealerId, status: status || undefined },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(dealerId: string, id: string) {
    return this.prisma.creditNote.findFirst({
      where: { id, dealerId },
      include: { lines: { orderBy: { createdAt: 'asc' } } },
    });
  }

  create(dealerId: string, dto: CreateCreditNoteDto) {
    const { lines, subtotal, taxAmount, total } = this.computeLines(dto.lines);
    return this.prisma.creditNote.create({
      data: {
        dealerId,
        customerName: dto.customerName,
        reason: dto.reason,
        relatedInvoiceRef: dto.relatedInvoiceRef,
        status: CreditNoteStatus.DRAFT,
        subtotal,
        taxAmount,
        total,
        lines: { create: lines },
      },
      include: { lines: true },
    });
  }

  /** Only DRAFT notes are editable; once issued the numbered document is fixed. */
  async update(dealerId: string, id: string, dto: UpdateCreditNoteDto) {
    const note = await this.prisma.creditNote.findFirst({ where: { id, dealerId } });
    if (!note) {
      throw new NotFoundException('Credit note not found');
    }
    if (note.status !== CreditNoteStatus.DRAFT) {
      throw new BadRequestException('Only draft credit notes can be edited');
    }

    const totals = dto.lines ? this.computeLines(dto.lines) : null;

    return this.prisma.$transaction(async (tx) => {
      if (totals) {
        await tx.creditNoteLine.deleteMany({ where: { creditNoteId: id } });
      }
      return tx.creditNote.update({
        where: { id },
        data: {
          customerName: dto.customerName,
          reason: dto.reason,
          relatedInvoiceRef: dto.relatedInvoiceRef,
          ...(totals
            ? {
                subtotal: totals.subtotal,
                taxAmount: totals.taxAmount,
                total: totals.total,
                lines: { create: totals.lines },
              }
            : {}),
        },
        include: { lines: true },
      });
    });
  }

  /** DRAFT → ISSUED: reserve the document number and stamp the issue date. */
  async issue(dealerId: string, id: string) {
    const note = await this.prisma.creditNote.findFirst({ where: { id, dealerId } });
    if (!note) {
      throw new NotFoundException('Credit note not found');
    }
    if (note.status !== CreditNoteStatus.DRAFT) {
      throw new BadRequestException('Only draft credit notes can be issued');
    }
    const number = note.number ?? (await this.sequences.nextNumber(dealerId, 'CREDIT_NOTE'));
    return this.prisma.creditNote.update({
      where: { id },
      data: { status: CreditNoteStatus.ISSUED, number, issuedAt: new Date() },
      include: { lines: true },
    });
  }

  /** ISSUED → APPLIED: the credit has been offset against a customer balance. */
  async apply(dealerId: string, id: string) {
    const note = await this.prisma.creditNote.findFirst({ where: { id, dealerId } });
    if (!note) {
      throw new NotFoundException('Credit note not found');
    }
    if (note.status !== CreditNoteStatus.ISSUED) {
      throw new BadRequestException('Only issued credit notes can be applied');
    }
    return this.prisma.creditNote.update({
      where: { id },
      data: { status: CreditNoteStatus.APPLIED },
      include: { lines: true },
    });
  }

  /** Void a note that should not have been raised. An already-applied credit can't be cancelled. */
  async cancel(dealerId: string, id: string) {
    const note = await this.prisma.creditNote.findFirst({ where: { id, dealerId } });
    if (!note) {
      throw new NotFoundException('Credit note not found');
    }
    if (note.status === CreditNoteStatus.APPLIED) {
      throw new BadRequestException('An applied credit note cannot be cancelled');
    }
    return this.prisma.creditNote.update({
      where: { id },
      data: { status: CreditNoteStatus.CANCELLED },
      include: { lines: true },
    });
  }

  /** Net line totals plus rolled-up subtotal/tax/total (tax per-line so mixed rates are correct). */
  private computeLines(lines: CreditNoteLineDto[]) {
    const computed = lines.map((line) => {
      const taxRate = line.taxRate ?? 0.2;
      const lineTotal = round2(line.quantity * line.unitPrice);
      return {
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate,
        lineTotal,
      };
    });
    const subtotal = round2(computed.reduce((sum, l) => sum + l.lineTotal, 0));
    const taxAmount = round2(computed.reduce((sum, l) => sum + l.lineTotal * l.taxRate, 0));
    const total = round2(subtotal + taxAmount);
    return { lines: computed, subtotal, taxAmount, total };
  }
}

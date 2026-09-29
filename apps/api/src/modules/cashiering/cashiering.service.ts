import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentKind, PaymentMethod } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountCustomersService } from '../account-customers/account-customers.service';
import { CreatePaymentDto } from './dto/payment.dto';

/**
 * Cashiering / cash desk (#1) — takes money at the counter (payments, deposits, refunds) across
 * cash/card/bank/cheque, optionally against an account customer's ledger, and reconciles the till
 * for a day. This is the piece that actually *collects* money, closing the loop after invoices and
 * credit notes.
 */
@Injectable()
export class CashieringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountCustomers: AccountCustomersService,
  ) {}

  findAll(dealerId: string, filters: { kind?: PaymentKind; method?: PaymentMethod; date?: string }) {
    const where: {
      dealerId: string;
      kind?: PaymentKind;
      method?: PaymentMethod;
      receivedAt?: { gte: Date; lte: Date };
    } = { dealerId };
    if (filters.kind) where.kind = filters.kind;
    if (filters.method) where.method = filters.method;
    if (filters.date) {
      const { start, end } = this.dayBounds(filters.date);
      where.receivedAt = { gte: start, lte: end };
    }
    return this.prisma.payment.findMany({ where, orderBy: { receivedAt: 'desc' }, take: 200 });
  }

  async create(dealerId: string, dto: CreatePaymentDto, receivedBy: string) {
    const kind = dto.kind ?? PaymentKind.PAYMENT;

    if (dto.accountCustomerId) {
      // Verify the account belongs to this dealer (throws if not), then post the ledger movement.
      await this.accountCustomers.findOne(dealerId, dto.accountCustomerId);
    }

    const payment = await this.prisma.payment.create({
      data: {
        dealerId,
        kind,
        method: dto.method,
        amount: dto.amount,
        customerName: dto.customerName,
        reference: dto.reference,
        accountCustomerId: dto.accountCustomerId,
        notes: dto.notes,
        receivedBy,
      },
    });

    if (dto.accountCustomerId) {
      await this.accountCustomers.postCashDeskPayment(dto.accountCustomerId, kind, dto.amount, dto.reference);
    }

    return payment;
  }

  /** End-of-day cash-up: totals by payment method and by kind for the given day (default today). */
  async reconciliation(dealerId: string, date?: string) {
    const { start, end } = this.dayBounds(date ?? new Date().toISOString());
    const payments = await this.prisma.payment.findMany({
      where: { dealerId, receivedAt: { gte: start, lte: end } },
    });

    const signed = (kind: string, amount: number) => (kind === PaymentKind.REFUND ? -amount : amount);
    const byMethod: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    let net = 0;
    for (const p of payments) {
      const amt = Number(p.amount);
      byMethod[p.method] = (byMethod[p.method] ?? 0) + signed(p.kind, amt);
      byKind[p.kind] = (byKind[p.kind] ?? 0) + amt;
      net += signed(p.kind, amt);
    }
    return {
      date: start,
      count: payments.length,
      net: Math.round((net + Number.EPSILON) * 100) / 100,
      byMethod,
      byKind,
    };
  }

  private dayBounds(dateIso: string) {
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
}

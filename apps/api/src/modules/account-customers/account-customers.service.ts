import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountTransactionType, PaymentKind } from '@project-amx/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AddAccountTransactionDto, CreateAccountCustomerDto, UpdateAccountCustomerDto } from './dto/account-customer.dto';

/** Signed effect of a transaction on the account balance (positive = customer owes the dealer).
 * Typed as string so it accepts both the shared and Prisma-generated AccountTransactionType. */
function balanceDelta(type: string, amount: number): number {
  return type === AccountTransactionType.INVOICE ? amount : -amount;
}

/**
 * Account customers (#2) — trade/credit customers invoiced on account, with a running balance,
 * statements and an aged-debtors view. Also the single place the cash desk posts an account
 * payment, so balance mutation logic lives here rather than being duplicated in the payment flow.
 */
@Injectable()
export class AccountCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(dealerId: string, active?: boolean) {
    return this.prisma.accountCustomer.findMany({
      where: { dealerId, active: active === undefined ? undefined : active },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(dealerId: string, id: string) {
    const customer = await this.prisma.accountCustomer.findFirst({
      where: { id, dealerId },
      include: { transactions: { orderBy: { occurredAt: 'desc' }, take: 50 } },
    });
    if (!customer) {
      throw new NotFoundException('Account customer not found');
    }
    return customer;
  }

  create(dealerId: string, dto: CreateAccountCustomerDto) {
    return this.prisma.accountCustomer.create({
      data: {
        dealerId,
        name: dto.name,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        creditLimit: dto.creditLimit ?? 0,
      },
    });
  }

  async update(dealerId: string, id: string, dto: UpdateAccountCustomerDto) {
    await this.ensure(dealerId, id);
    return this.prisma.accountCustomer.update({ where: { id }, data: dto });
  }

  /** Posts a statement line and moves the running balance atomically. */
  async addTransaction(dealerId: string, id: string, dto: AddAccountTransactionDto) {
    await this.ensure(dealerId, id);
    return this.postTransaction(id, {
      type: dto.type,
      description: dto.description,
      amount: dto.amount,
      reference: dto.reference,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
    });
  }

  /** Called by the cash desk when a payment/deposit is taken against an account customer. */
  async postCashDeskPayment(id: string, kind: PaymentKind, amount: number, reference?: string) {
    // A refund hands money back, so it increases what the account owes (INVOICE); a payment or
    // deposit reduces it (PAYMENT).
    const type = kind === PaymentKind.REFUND ? AccountTransactionType.INVOICE : AccountTransactionType.PAYMENT;
    return this.postTransaction(id, {
      type,
      description: `Cash desk ${kind.toLowerCase()}`,
      amount,
      reference,
      occurredAt: new Date(),
    });
  }

  /** Statement for a period: opening balance, the period's lines, and the closing balance. */
  async statement(dealerId: string, id: string, from?: string, to?: string) {
    const customer = await this.ensure(dealerId, id);
    const fromDate = from ? new Date(from) : new Date(0);
    const toDate = to ? new Date(to) : new Date();

    const [priorTxns, periodTxns] = await Promise.all([
      this.prisma.accountTransaction.findMany({
        where: { accountCustomerId: id, occurredAt: { lt: fromDate } },
      }),
      this.prisma.accountTransaction.findMany({
        where: { accountCustomerId: id, occurredAt: { gte: fromDate, lte: toDate } },
        orderBy: { occurredAt: 'asc' },
      }),
    ]);

    const openingBalance = priorTxns.reduce((sum, t) => sum + balanceDelta(t.type, Number(t.amount)), 0);
    let running = openingBalance;
    const lines = periodTxns.map((t) => {
      running += balanceDelta(t.type, Number(t.amount));
      return {
        id: t.id,
        type: t.type,
        description: t.description,
        reference: t.reference,
        occurredAt: t.occurredAt,
        amount: Number(t.amount),
        signedAmount: balanceDelta(t.type, Number(t.amount)),
        runningBalance: Math.round((running + Number.EPSILON) * 100) / 100,
      };
    });

    return {
      customer: { id: customer.id, name: customer.name, creditLimit: Number(customer.creditLimit) },
      from: fromDate,
      to: toDate,
      openingBalance: Math.round((openingBalance + Number.EPSILON) * 100) / 100,
      closingBalance: Number(customer.balance),
      lines,
    };
  }

  /** Aged-debtors report: each customer owing money, bucketed by the age of their oldest invoice. */
  async agedDebtors(dealerId: string) {
    const customers = await this.prisma.accountCustomer.findMany({
      where: { dealerId, balance: { gt: 0 } },
      orderBy: { balance: 'desc' },
    });
    const now = Date.now();
    const rows = await Promise.all(
      customers.map(async (c) => {
        const oldestInvoice = await this.prisma.accountTransaction.findFirst({
          where: { accountCustomerId: c.id, type: AccountTransactionType.INVOICE },
          orderBy: { occurredAt: 'asc' },
        });
        const ageDays = oldestInvoice ? Math.floor((now - oldestInvoice.occurredAt.getTime()) / 86_400_000) : 0;
        const balance = Number(c.balance);
        return {
          id: c.id,
          name: c.name,
          balance,
          ageDays,
          current: ageDays <= 30 ? balance : 0,
          days30: ageDays > 30 && ageDays <= 60 ? balance : 0,
          days60: ageDays > 60 && ageDays <= 90 ? balance : 0,
          days90plus: ageDays > 90 ? balance : 0,
        };
      }),
    );
    const total = rows.reduce((s, r) => s + r.balance, 0);
    return { rows, total: Math.round((total + Number.EPSILON) * 100) / 100 };
  }

  private async postTransaction(
    accountCustomerId: string,
    txn: { type: AccountTransactionType; description: string; amount: number; reference?: string; occurredAt: Date },
  ) {
    const delta = balanceDelta(txn.type, txn.amount);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.accountTransaction.create({
        data: {
          accountCustomerId,
          type: txn.type,
          description: txn.description,
          amount: txn.amount,
          reference: txn.reference,
          occurredAt: txn.occurredAt,
        },
      });
      await tx.accountCustomer.update({
        where: { id: accountCustomerId },
        data: { balance: { increment: new Prisma.Decimal(delta) } },
      });
      return created;
    });
  }

  private async ensure(dealerId: string, id: string) {
    const customer = await this.prisma.accountCustomer.findFirst({ where: { id, dealerId } });
    if (!customer) {
      throw new NotFoundException('Account customer not found');
    }
    return customer;
  }
}

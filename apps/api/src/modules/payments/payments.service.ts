import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JournalSourceType, PaymentSourceType, PaymentStatus } from '@prisma/client';
import { PaymentMethod } from '@project-amx/shared';
import { PaymentGatewayService } from '../../common/payments/payment-gateway.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CONTROL_ACCOUNT_CODES } from '../ledger/ledger.constants';
import { LedgerService } from '../ledger/ledger.service';

interface PayableInvoice {
  id: string;
  dealerId: string;
  invoiceNumber: string;
  totalAmount: number;
  recipient: string;
  paidAt: Date | null;
}

/**
 * Card/bank-transfer/cash payments against a customer-facing invoice — the "take a payment
 * online, it reconciles into the ledger automatically" gap this app had against Keyloop Payments
 * and Pinewood.AI's Bumper-integrated checkout. Used by both the staff-side "take payment" action
 * and the unauthenticated public pay-invoice page (PaymentsController).
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGatewayService,
    private readonly ledgerService: LedgerService,
  ) {}

  list(dealerId: string) {
    return this.prisma.payment.findMany({ where: { dealerId }, orderBy: { createdAt: 'desc' } });
  }

  /** Looked up by id alone (no dealerId filter) for the public pay page — the same "unguessable
   * UUID is the access control" convention VhcService.findPublic() already uses in this app. */
  async findPayable(sourceType: PaymentSourceType, sourceId: string): Promise<PayableInvoice> {
    const invoice = await this.resolveInvoice(sourceType, sourceId, undefined);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  /** Staff-side: takes a payment against an invoice known to belong to this dealer. */
  pay(dealerId: string, sourceType: PaymentSourceType, sourceId: string, method: PaymentMethod) {
    return this.processPayment(sourceType, sourceId, method, dealerId);
  }

  /** Public-side: the invoice's own dealerId is trusted since the id itself is the access
   * control — there is no authenticated caller to scope the lookup to. */
  payPublic(sourceType: PaymentSourceType, sourceId: string, method: PaymentMethod) {
    return this.processPayment(sourceType, sourceId, method, undefined);
  }

  private async processPayment(sourceType: PaymentSourceType, sourceId: string, method: PaymentMethod, dealerId: string | undefined) {
    const invoice = await this.resolveInvoice(sourceType, sourceId, dealerId);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.paidAt) {
      throw new BadRequestException('This invoice has already been paid');
    }

    const payment = await this.prisma.payment.create({
      data: { dealerId: invoice.dealerId, sourceType, sourceId, amount: invoice.totalAmount, method, status: PaymentStatus.PENDING },
    });

    const result = await this.gateway.charge(invoice.totalAmount, method);
    if (!result.success) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, failureReason: result.failureReason },
      });
      throw new BadRequestException(result.failureReason ?? 'Payment failed');
    }

    const paidAt = new Date();
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.SUCCEEDED, providerRef: result.providerRef, paidAt },
    });
    await this.markInvoicePaid(sourceType, sourceId, paidAt);

    await this.ledgerService.postSafely(invoice.dealerId, {
      reference: invoice.invoiceNumber,
      description: `Payment received — ${invoice.invoiceNumber} (${method})`,
      sourceType: JournalSourceType.CUSTOMER_INVOICE,
      sourceId: payment.id,
      lines: [
        { accountCode: CONTROL_ACCOUNT_CODES.BANK, debit: invoice.totalAmount },
        { accountCode: CONTROL_ACCOUNT_CODES.DEBTORS_CONTROL, credit: invoice.totalAmount },
      ],
    });

    return this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  }

  private async resolveInvoice(
    sourceType: PaymentSourceType,
    sourceId: string,
    dealerId: string | undefined,
  ): Promise<PayableInvoice | null> {
    if (sourceType === PaymentSourceType.AFTERSALES_INVOICE) {
      const invoice = await this.prisma.aftersalesInvoice.findFirst({ where: { id: sourceId, dealerId } });
      if (!invoice) return null;
      return { id: invoice.id, dealerId: invoice.dealerId, invoiceNumber: invoice.invoiceNumber, totalAmount: Number(invoice.totalAmount), recipient: invoice.recipient ?? '', paidAt: invoice.paidAt };
    }
    const invoice = await this.prisma.customerInvoice.findFirst({ where: { id: sourceId, dealerId } });
    if (!invoice) return null;
    return { id: invoice.id, dealerId: invoice.dealerId, invoiceNumber: invoice.invoiceNumber, totalAmount: Number(invoice.totalAmount), recipient: invoice.description, paidAt: invoice.paidAt };
  }

  private markInvoicePaid(sourceType: PaymentSourceType, sourceId: string, paidAt: Date) {
    if (sourceType === PaymentSourceType.AFTERSALES_INVOICE) {
      return this.prisma.aftersalesInvoice.update({ where: { id: sourceId }, data: { paidAt } });
    }
    return this.prisma.customerInvoice.update({ where: { id: sourceId }, data: { paidAt } });
  }
}

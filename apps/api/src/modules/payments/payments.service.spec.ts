import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PaymentSourceType } from '@project-amx/shared';
import { PaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

function makeAftersalesInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    dealerId: 'dealer-1',
    invoiceNumber: 'INV-1',
    recipient: 'Jamie Smith',
    totalAmount: 120,
    paidAt: null,
    ...overrides,
  };
}

describe('PaymentsService.findPayable', () => {
  it('throws when the invoice does not exist', async () => {
    const prisma = { aftersalesInvoice: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new PaymentsService(prisma as never, {} as never, {} as never);
    await expect(service.findPayable(PaymentSourceType.AFTERSALES_INVOICE, 'missing')).rejects.toThrow(NotFoundException);
  });

  it('looks up by id alone, with no dealer scoping, for the public pay page', async () => {
    const findFirst = jest.fn().mockResolvedValue(makeAftersalesInvoice());
    const prisma = { aftersalesInvoice: { findFirst } };
    const service = new PaymentsService(prisma as never, {} as never, {} as never);
    await service.findPayable(PaymentSourceType.AFTERSALES_INVOICE, 'inv-1');
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'inv-1', dealerId: undefined } });
  });
});

describe('PaymentsService.pay / payPublic', () => {
  it('refuses to pay an invoice that has already been paid', async () => {
    const invoice = makeAftersalesInvoice({ paidAt: new Date() });
    const prisma = { aftersalesInvoice: { findFirst: jest.fn().mockResolvedValue(invoice) } };
    const service = new PaymentsService(prisma as never, {} as never, {} as never);
    await expect(service.pay('dealer-1', PaymentSourceType.AFTERSALES_INVOICE, 'inv-1', PaymentMethod.CARD)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('charges the invoice total via the gateway, marks it paid, and posts Bank against Debtors Control', async () => {
    const invoice = makeAftersalesInvoice();
    const create = jest.fn().mockResolvedValue({ id: 'payment-1' });
    const update = jest.fn();
    const findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'payment-1', status: PaymentStatus.SUCCEEDED });
    const updateInvoice = jest.fn();
    const prisma = {
      aftersalesInvoice: { findFirst: jest.fn().mockResolvedValue(invoice), update: updateInvoice },
      payment: { create, update, findUniqueOrThrow },
    };
    const gateway = { charge: jest.fn().mockResolvedValue({ success: true, providerRef: 'PAY-MOCK-1' }) };
    const ledger = { postSafely: jest.fn() };
    const service = new PaymentsService(prisma as never, gateway as never, ledger as never);

    await service.pay('dealer-1', PaymentSourceType.AFTERSALES_INVOICE, 'inv-1', PaymentMethod.CARD);

    expect(gateway.charge).toHaveBeenCalledWith(120, PaymentMethod.CARD);
    expect(updateInvoice).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'inv-1' }, data: expect.objectContaining({ paidAt: expect.any(Date) }) }));
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: PaymentStatus.SUCCEEDED, providerRef: 'PAY-MOCK-1' }) }),
    );
    expect(ledger.postSafely).toHaveBeenCalledWith(
      'dealer-1',
      expect.objectContaining({
        lines: expect.arrayContaining([expect.objectContaining({ debit: 120 }), expect.objectContaining({ credit: 120 })]),
      }),
    );
  });

  it('marks the payment FAILED and throws when the gateway declines', async () => {
    const invoice = makeAftersalesInvoice();
    const update = jest.fn();
    const prisma = {
      aftersalesInvoice: { findFirst: jest.fn().mockResolvedValue(invoice) },
      payment: { create: jest.fn().mockResolvedValue({ id: 'payment-1' }), update },
    };
    const gateway = { charge: jest.fn().mockResolvedValue({ success: false, failureReason: 'Card declined' }) };
    const ledger = { postSafely: jest.fn() };
    const service = new PaymentsService(prisma as never, gateway as never, ledger as never);

    await expect(service.pay('dealer-1', PaymentSourceType.AFTERSALES_INVOICE, 'inv-1', PaymentMethod.CARD)).rejects.toThrow(
      BadRequestException,
    );
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: PaymentStatus.FAILED }) }));
    expect(ledger.postSafely).not.toHaveBeenCalled();
  });

  it('payPublic does not scope the lookup by dealerId', async () => {
    const invoice = makeAftersalesInvoice();
    const findFirst = jest.fn().mockResolvedValue(invoice);
    const prisma = {
      aftersalesInvoice: { findFirst, update: jest.fn() },
      payment: { create: jest.fn().mockResolvedValue({ id: 'payment-1' }), update: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue({}) },
    };
    const gateway = { charge: jest.fn().mockResolvedValue({ success: true, providerRef: 'PAY-MOCK-2' }) };
    const ledger = { postSafely: jest.fn() };
    const service = new PaymentsService(prisma as never, gateway as never, ledger as never);

    await service.payPublic(PaymentSourceType.AFTERSALES_INVOICE, 'inv-1', PaymentMethod.CARD);

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'inv-1', dealerId: undefined } });
  });
});

import { NotFoundException } from '@nestjs/common';
import { CustomerInvoiceService } from './customer-invoice.service';

function makeDeps() {
  return {
    pdf: { renderAndStore: jest.fn().mockResolvedValue('https://files.local/customer-invoices/invoice-1.html') },
    documentSequences: { nextNumber: jest.fn().mockResolvedValue('CSI-2026-00001') },
    documentTemplates: { getDefaultBody: jest.fn().mockResolvedValue('<html></html>') },
    ledger: { postSafely: jest.fn() },
  };
}

describe('CustomerInvoiceService.create', () => {
  const dealerId = 'dealer-1';
  const contactId = 'contact-1';

  it('throws when the contact does not belong to this dealer', async () => {
    const deps = makeDeps();
    const prisma = { contact: { findFirst: jest.fn().mockResolvedValue(null) }, customerInvoice: { create: jest.fn() } };
    const service = new CustomerInvoiceService(prisma as never, deps.pdf as never, deps.documentSequences as never, deps.documentTemplates as never, deps.ledger as never);

    await expect(service.create(dealerId, contactId, { description: 'Lost key charge', amount: 100 })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.customerInvoice.create).not.toHaveBeenCalled();
  });

  it('computes 20% VAT and the total, and persists the rendered PDF url', async () => {
    const deps = makeDeps();
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const prisma = {
      contact: { findFirst: jest.fn().mockResolvedValue({ id: contactId, firstName: 'Jamie', lastName: 'Doe' }) },
      dealer: { findUnique: jest.fn().mockResolvedValue({ id: dealerId, name: 'Test Dealer' }) },
      customerInvoice: { create },
    };
    const service = new CustomerInvoiceService(prisma as never, deps.pdf as never, deps.documentSequences as never, deps.documentTemplates as never, deps.ledger as never);

    const result = await service.create(dealerId, contactId, { description: 'Lost key charge', amount: 100 });

    expect(result).toEqual(
      expect.objectContaining({
        dealerId,
        contactId,
        invoiceNumber: 'CSI-2026-00001',
        amount: 100,
        vatAmount: 20,
        totalAmount: 120,
        pdfUrl: 'https://files.local/customer-invoices/invoice-1.html',
      }),
    );
  });
});

describe('CustomerInvoiceService.list', () => {
  it("scopes to the dealer and the given contact's own invoices", async () => {
    const deps = makeDeps();
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { customerInvoice: { findMany } };
    const service = new CustomerInvoiceService(prisma as never, deps.pdf as never, deps.documentSequences as never, deps.documentTemplates as never, deps.ledger as never);

    await service.list('dealer-1', 'contact-1');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { dealerId: 'dealer-1', contactId: 'contact-1' } }));
  });
});

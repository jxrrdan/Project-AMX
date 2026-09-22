import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SupplierInvoiceStatus } from '@prisma/client';
import { PurchasingService } from './purchasing.service';

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    dealerId: 'dealer-1',
    supplierId: 'supplier-1',
    supplier: { id: 'supplier-1', name: 'ACME Parts Ltd' },
    purchaseOrderId: null,
    purchaseOrder: null,
    goodsReceiptNoteId: null,
    goodsReceiptNote: null,
    invoiceNumber: 'INV-1',
    invoiceDate: new Date('2026-01-15'),
    netAmount: 100,
    vatAmount: 20,
    totalAmount: 120,
    status: SupplierInvoiceStatus.DRAFT,
    lines: [],
    ...overrides,
  };
}

describe('PurchasingService.createGoodsReceiptNote', () => {
  it('throws when the purchase order does not belong to this dealer', async () => {
    const prisma = { purchaseOrder: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new PurchasingService(prisma as never, {} as never, {} as never, {} as never);
    await expect(
      service.createGoodsReceiptNote('dealer-1', { purchaseOrderId: 'missing', lines: [] } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a line that does not belong to the purchase order', async () => {
    const prisma = {
      purchaseOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'po-1', supplierId: 'supplier-1', lines: [{ id: 'line-1' }] }) },
    };
    const service = new PurchasingService(prisma as never, {} as never, {} as never, {} as never);
    await expect(
      service.createGoodsReceiptNote('dealer-1', {
        purchaseOrderId: 'po-1',
        lines: [{ purchaseOrderLineId: 'other-line', quantityReceived: 2 }],
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('receives each line via PartsService then creates the GRN', async () => {
    const receivePurchaseOrderLine = jest.fn().mockResolvedValue({ success: true });
    const create = jest.fn().mockResolvedValue({ id: 'grn-1' });
    const prisma = {
      purchaseOrder: {
        findFirst: jest.fn().mockResolvedValue({ id: 'po-1', supplierId: 'supplier-1', lines: [{ id: 'line-1' }] }),
      },
      goodsReceiptNote: { create },
    };
    const documentSequences = { nextNumber: jest.fn().mockResolvedValue('GRN-2026-00001') };
    const partsService = { receivePurchaseOrderLine };
    const service = new PurchasingService(prisma as never, documentSequences as never, partsService as never, {} as never);

    await service.createGoodsReceiptNote('dealer-1', {
      purchaseOrderId: 'po-1',
      lines: [{ purchaseOrderLineId: 'line-1', quantityReceived: 4 }],
    } as never);

    expect(receivePurchaseOrderLine).toHaveBeenCalledWith('dealer-1', 'line-1', 4);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dealerId: 'dealer-1', supplierId: 'supplier-1', grnNumber: 'GRN-2026-00001' }) }),
    );
  });
});

describe('PurchasingService.matchInvoice', () => {
  it('refuses to match an invoice with no linked purchase order', async () => {
    const invoice = makeInvoice();
    const prisma = { supplierInvoice: { findFirst: jest.fn().mockResolvedValue(invoice) } };
    const service = new PurchasingService(prisma as never, {} as never, {} as never, {} as never);
    await expect(service.matchInvoice('dealer-1', 'inv-1')).rejects.toThrow(BadRequestException);
  });

  it('marks MATCHED when the invoice net amount equals the PO total', async () => {
    const invoice = makeInvoice({
      purchaseOrderId: 'po-1',
      purchaseOrder: { lines: [{ quantityOrdered: 10, unitCost: 10 }] },
      netAmount: 100,
    });
    const update = jest.fn().mockResolvedValue({ status: SupplierInvoiceStatus.MATCHED });
    const prisma = { supplierInvoice: { findFirst: jest.fn().mockResolvedValue(invoice), update } };
    const service = new PurchasingService(prisma as never, {} as never, {} as never, {} as never);
    await service.matchInvoice('dealer-1', 'inv-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: SupplierInvoiceStatus.MATCHED, matchDiscrepancy: null }) }),
    );
  });

  it('marks DISCREPANCY with an explanatory note when amounts differ', async () => {
    const invoice = makeInvoice({
      purchaseOrderId: 'po-1',
      purchaseOrder: { lines: [{ quantityOrdered: 10, unitCost: 10 }] },
      netAmount: 150,
    });
    const update = jest.fn().mockResolvedValue({ status: SupplierInvoiceStatus.DISCREPANCY });
    const prisma = { supplierInvoice: { findFirst: jest.fn().mockResolvedValue(invoice), update } };
    const service = new PurchasingService(prisma as never, {} as never, {} as never, {} as never);
    await service.matchInvoice('dealer-1', 'inv-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SupplierInvoiceStatus.DISCREPANCY, matchDiscrepancy: expect.stringContaining('Expected') }),
      }),
    );
  });
});

describe('PurchasingService.approveInvoice', () => {
  it('blocks approval of a PO-linked invoice that has not been matched yet', async () => {
    const invoice = makeInvoice({ purchaseOrderId: 'po-1', status: SupplierInvoiceStatus.DRAFT });
    const prisma = { supplierInvoice: { findFirst: jest.fn().mockResolvedValue(invoice) } };
    const service = new PurchasingService(prisma as never, {} as never, {} as never, { post: jest.fn() } as never);
    await expect(service.approveInvoice('dealer-1', 'inv-1', 'user-1')).rejects.toThrow(BadRequestException);
  });

  it('posts a balanced journal and approves a direct (no-PO) invoice', async () => {
    const invoice = makeInvoice();
    const update = jest.fn().mockResolvedValue({ status: SupplierInvoiceStatus.APPROVED });
    const prisma = { supplierInvoice: { findFirst: jest.fn().mockResolvedValue(invoice), update } };
    const post = jest.fn().mockResolvedValue({ id: 'je-1' });
    const service = new PurchasingService(prisma as never, {} as never, {} as never, { post } as never);

    await service.approveInvoice('dealer-1', 'inv-1', 'user-1');

    expect(post).toHaveBeenCalledWith(
      'dealer-1',
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({ debit: 100 }),
          expect.objectContaining({ credit: 120 }),
        ]),
      }),
    );
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: SupplierInvoiceStatus.APPROVED }) }));
  });

  it('refuses to re-approve an already-approved invoice', async () => {
    const invoice = makeInvoice({ status: SupplierInvoiceStatus.APPROVED });
    const prisma = { supplierInvoice: { findFirst: jest.fn().mockResolvedValue(invoice) } };
    const service = new PurchasingService(prisma as never, {} as never, {} as never, { post: jest.fn() } as never);
    await expect(service.approveInvoice('dealer-1', 'inv-1', 'user-1')).rejects.toThrow(BadRequestException);
  });
});

describe('PurchasingService.markInvoicePaid', () => {
  it('refuses to pay an invoice that has not been approved', async () => {
    const invoice = makeInvoice({ status: SupplierInvoiceStatus.DRAFT });
    const prisma = { supplierInvoice: { findFirst: jest.fn().mockResolvedValue(invoice) } };
    const service = new PurchasingService(prisma as never, {} as never, {} as never, { post: jest.fn() } as never);
    await expect(service.markInvoicePaid('dealer-1', 'inv-1')).rejects.toThrow(BadRequestException);
  });

  it('posts Creditors->Bank and marks PAID for an approved invoice', async () => {
    const invoice = makeInvoice({ status: SupplierInvoiceStatus.APPROVED });
    const update = jest.fn().mockResolvedValue({ status: SupplierInvoiceStatus.PAID });
    const prisma = { supplierInvoice: { findFirst: jest.fn().mockResolvedValue(invoice), update } };
    const post = jest.fn().mockResolvedValue({ id: 'je-2' });
    const service = new PurchasingService(prisma as never, {} as never, {} as never, { post } as never);

    await service.markInvoicePaid('dealer-1', 'inv-1');

    expect(post).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: SupplierInvoiceStatus.PAID } }));
  });
});

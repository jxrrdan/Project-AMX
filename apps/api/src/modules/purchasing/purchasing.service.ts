import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JournalSourceType, SupplierInvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DocumentSequenceService } from '../dealers/document-sequence.service';
import { PartsService } from '../parts/parts.service';
import { CONTROL_ACCOUNT_CODES } from '../ledger/ledger.constants';
import { LedgerService } from '../ledger/ledger.service';
import {
  CreateGoodsReceiptNoteDto,
  CreateSupplierDto,
  CreateSupplierInvoiceDto,
  UpdateSupplierDto,
} from './dto/purchasing.dto';

@Injectable()
export class PurchasingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentSequences: DocumentSequenceService,
    private readonly partsService: PartsService,
    private readonly ledgerService: LedgerService,
  ) {}

  // --- Suppliers -----------------------------------------------------------

  listSuppliers(dealerId: string) {
    return this.prisma.supplier.findMany({ where: { dealerId }, orderBy: { name: 'asc' } });
  }

  createSupplier(dealerId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: { dealerId, ...dto } });
  }

  async findSupplier(dealerId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, dealerId },
      include: { purchaseOrders: { orderBy: { createdAt: 'desc' }, take: 10 }, supplierInvoices: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return supplier;
  }

  async updateSupplier(dealerId: string, id: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, dealerId } });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  // --- Goods receipt notes ---------------------------------------------------

  listGoodsReceiptNotes(dealerId: string) {
    return this.prisma.goodsReceiptNote.findMany({
      where: { dealerId },
      include: { supplier: true, purchaseOrder: true, lines: true },
      orderBy: { receivedAt: 'desc' },
    });
  }

  /** Records goods received against a PO, updating stock/PO status per line via PartsService,
   * then formalises the delivery as a standalone GoodsReceiptNote for 3-way invoice matching. */
  async createGoodsReceiptNote(dealerId: string, dto: CreateGoodsReceiptNoteDto) {
    const purchaseOrder = await this.prisma.purchaseOrder.findFirst({
      where: { id: dto.purchaseOrderId, dealerId },
      include: { lines: true },
    });
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }
    const lineIds = new Set(purchaseOrder.lines.map((line) => line.id));
    for (const line of dto.lines) {
      if (!lineIds.has(line.purchaseOrderLineId)) {
        throw new BadRequestException(`Purchase order line ${line.purchaseOrderLineId} does not belong to this order`);
      }
    }

    for (const line of dto.lines) {
      await this.partsService.receivePurchaseOrderLine(dealerId, line.purchaseOrderLineId, line.quantityReceived);
    }

    const grnNumber = await this.documentSequences.nextNumber(dealerId, 'GRN');
    return this.prisma.goodsReceiptNote.create({
      data: {
        dealerId,
        grnNumber,
        purchaseOrderId: dto.purchaseOrderId,
        supplierId: purchaseOrder.supplierId,
        notes: dto.notes,
        lines: { create: dto.lines },
      },
      include: { lines: true },
    });
  }

  async findGoodsReceiptNote(dealerId: string, id: string) {
    const grn = await this.prisma.goodsReceiptNote.findFirst({
      where: { id, dealerId },
      include: { supplier: true, purchaseOrder: { include: { lines: true } }, lines: { include: { purchaseOrderLine: true } } },
    });
    if (!grn) {
      throw new NotFoundException('Goods receipt note not found');
    }
    return grn;
  }

  // --- Supplier invoices & 3-way matching -------------------------------------

  listSupplierInvoices(dealerId: string) {
    return this.prisma.supplierInvoice.findMany({
      where: { dealerId },
      include: { supplier: true, purchaseOrder: true, goodsReceiptNote: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSupplierInvoice(dealerId: string, dto: CreateSupplierInvoiceDto) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: dto.supplierId, dealerId } });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    if (dto.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findFirst({ where: { id: dto.purchaseOrderId, dealerId } });
      if (!po) {
        throw new NotFoundException('Purchase order not found');
      }
    }
    if (dto.goodsReceiptNoteId) {
      const grn = await this.prisma.goodsReceiptNote.findFirst({ where: { id: dto.goodsReceiptNoteId, dealerId } });
      if (!grn) {
        throw new NotFoundException('Goods receipt note not found');
      }
    }

    return this.prisma.supplierInvoice.create({
      data: {
        dealerId,
        supplierId: dto.supplierId,
        purchaseOrderId: dto.purchaseOrderId,
        goodsReceiptNoteId: dto.goodsReceiptNoteId,
        invoiceNumber: dto.invoiceNumber,
        invoiceDate: new Date(dto.invoiceDate),
        netAmount: dto.netAmount,
        vatAmount: dto.vatAmount,
        totalAmount: dto.totalAmount,
        lines: dto.lines ? { create: dto.lines } : undefined,
      },
      include: { lines: true },
    });
  }

  async findSupplierInvoice(dealerId: string, id: string) {
    const invoice = await this.prisma.supplierInvoice.findFirst({
      where: { id, dealerId },
      include: {
        supplier: true,
        purchaseOrder: { include: { lines: true } },
        goodsReceiptNote: { include: { lines: { include: { purchaseOrderLine: true } } } },
        lines: true,
      },
    });
    if (!invoice) {
      throw new NotFoundException('Supplier invoice not found');
    }
    return invoice;
  }

  /** 3-way match: invoice net amount vs. what was actually ordered/received on its linked PO/GRN. */
  async matchInvoice(dealerId: string, id: string) {
    const invoice = await this.findSupplierInvoice(dealerId, id);
    if (!invoice.purchaseOrderId) {
      throw new BadRequestException('Only invoices linked to a purchase order can be matched');
    }

    let expectedNet: number;
    if (invoice.goodsReceiptNoteId && invoice.goodsReceiptNote) {
      expectedNet = invoice.goodsReceiptNote.lines.reduce(
        (sum, grnLine) => sum + grnLine.quantityReceived * Number(grnLine.purchaseOrderLine.unitCost),
        0,
      );
    } else {
      expectedNet = (invoice.purchaseOrder?.lines ?? []).reduce((sum, line) => sum + line.quantityOrdered * Number(line.unitCost), 0);
    }

    const diff = Number(invoice.netAmount) - expectedNet;
    const matched = Math.abs(diff) <= 0.01;
    return this.prisma.supplierInvoice.update({
      where: { id },
      data: {
        status: matched ? SupplierInvoiceStatus.MATCHED : SupplierInvoiceStatus.DISCREPANCY,
        matchDiscrepancy: matched
          ? null
          : `Expected £${expectedNet.toFixed(2)} from ${invoice.goodsReceiptNoteId ? 'goods receipt' : 'purchase order'}, invoice is £${Number(invoice.netAmount).toFixed(2)} (${diff > 0 ? '+' : ''}${diff.toFixed(2)})`,
      },
    });
  }

  /** Approves the invoice into the purchase ledger — posts net+VAT against Creditors Control. */
  async approveInvoice(dealerId: string, id: string, approvedById: string) {
    const invoice = await this.findSupplierInvoice(dealerId, id);
    if (invoice.status === SupplierInvoiceStatus.APPROVED || invoice.status === SupplierInvoiceStatus.PAID) {
      throw new BadRequestException('Invoice has already been approved');
    }
    if (invoice.purchaseOrderId && invoice.status !== SupplierInvoiceStatus.MATCHED) {
      throw new BadRequestException('Run 3-way matching before approving a purchase-order invoice');
    }

    const expenseAccountCode = CONTROL_ACCOUNT_CODES.PARTS_PURCHASES;
    await this.ledgerService.post(dealerId, {
      reference: invoice.invoiceNumber,
      description: `Supplier invoice ${invoice.invoiceNumber} — ${invoice.supplier.name}`,
      date: invoice.invoiceDate,
      sourceType: JournalSourceType.SUPPLIER_INVOICE,
      sourceId: invoice.id,
      lines: [
        { accountCode: expenseAccountCode, debit: Number(invoice.netAmount), description: invoice.supplier.name },
        ...(Number(invoice.vatAmount) > 0
          ? [{ accountCode: CONTROL_ACCOUNT_CODES.VAT_INPUT, debit: Number(invoice.vatAmount), vatAmount: Number(invoice.vatAmount) }]
          : []),
        { accountCode: CONTROL_ACCOUNT_CODES.CREDITORS_CONTROL, credit: Number(invoice.totalAmount) },
      ],
    });

    return this.prisma.supplierInvoice.update({
      where: { id },
      data: { status: SupplierInvoiceStatus.APPROVED, approvedAt: new Date(), approvedById },
    });
  }

  /** Settles an approved invoice out of the bank account, completing the purchase-to-pay cycle. */
  async markInvoicePaid(dealerId: string, id: string) {
    const invoice = await this.findSupplierInvoice(dealerId, id);
    if (invoice.status !== SupplierInvoiceStatus.APPROVED) {
      throw new BadRequestException('Only an approved invoice can be marked as paid');
    }

    await this.ledgerService.post(dealerId, {
      reference: invoice.invoiceNumber,
      description: `Payment of supplier invoice ${invoice.invoiceNumber} — ${invoice.supplier.name}`,
      sourceType: JournalSourceType.SUPPLIER_INVOICE,
      sourceId: invoice.id,
      lines: [
        { accountCode: CONTROL_ACCOUNT_CODES.CREDITORS_CONTROL, debit: Number(invoice.totalAmount) },
        { accountCode: CONTROL_ACCOUNT_CODES.BANK, credit: Number(invoice.totalAmount) },
      ],
    });

    return this.prisma.supplierInvoice.update({ where: { id }, data: { status: SupplierInvoiceStatus.PAID } });
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PurchaseOrderStatus, StockMovementType } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AllocatePartDto, CreatePartDto, CreatePurchaseOrderDto, CreateStockMovementDto } from './dto/part.dto';

@Injectable()
export class PartsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Catalogue & Inventory (§3.1) ---------------------------------------

  findAll(dealerId: string, search?: string) {
    return this.prisma.part.findMany({
      where: {
        dealerId,
        OR: search
          ? [
              { partNumber: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { partNumber: 'asc' },
    });
  }

  create(dealerId: string, dto: CreatePartDto) {
    return this.prisma.part.create({ data: { dealerId, ...dto } });
  }

  /** Auto-flag parts below reorder level (§3.3). */
  belowReorderLevel(dealerId: string) {
    return this.prisma.$queryRaw`
      SELECT * FROM parts WHERE "dealerId" = ${dealerId} AND "quantityOnHand" <= "reorderLevel"
    `;
  }

  // --- Stock movements (§3.2) --------------------------------------------

  async recordMovement(dealerId: string, dto: CreateStockMovementDto) {
    const part = await this.prisma.part.findFirst({ where: { id: dto.partId, dealerId } });
    if (!part) {
      throw new NotFoundException('Part not found');
    }

    const delta = dto.type === StockMovementType.GOODS_RECEIVED || dto.type === StockMovementType.RETURNED
      ? dto.quantity
      : -dto.quantity;

    if (part.quantityOnHand + delta < 0) {
      throw new BadRequestException('Movement would take stock below zero');
    }

    return this.prisma.$transaction([
      this.prisma.stockMovement.create({
        data: { dealerId, partId: dto.partId, type: dto.type, quantity: dto.quantity, reasonCode: dto.reasonCode, reference: dto.reference },
      }),
      this.prisma.part.update({ where: { id: dto.partId }, data: { quantityOnHand: { increment: delta } } }),
    ]);
  }

  // --- Allocation to jobs (§3.4) ------------------------------------------

  async allocateToJob(dealerId: string, dto: AllocatePartDto) {
    const part = await this.prisma.part.findFirst({ where: { id: dto.partId, dealerId } });
    if (!part) {
      throw new NotFoundException('Part not found');
    }
    if (part.quantityOnHand < dto.quantity) {
      throw new BadRequestException('Insufficient stock to allocate — part is on order');
    }

    return this.prisma.$transaction([
      this.prisma.partAllocation.create({ data: dto }),
      this.prisma.part.update({ where: { id: dto.partId }, data: { quantityOnHand: { decrement: dto.quantity } } }),
      this.prisma.stockMovement.create({
        data: { dealerId, partId: dto.partId, type: StockMovementType.ALLOCATED, quantity: dto.quantity, reference: dto.jobCardId },
      }),
    ]);
  }

  // --- Purchase orders (§3.3) ---------------------------------------------

  listPurchaseOrders(dealerId: string) {
    return this.prisma.purchaseOrder.findMany({ where: { dealerId }, include: { lines: { include: { part: true } } }, orderBy: { createdAt: 'desc' } });
  }

  /** Generates a suggested PO from every part currently at/below reorder level. */
  async generateSuggestedPurchaseOrder(dealerId: string, dto: CreatePurchaseOrderDto) {
    const allParts = await this.prisma.part.findMany({ where: { dealerId } });
    const lowStock = allParts.filter((part) => part.quantityOnHand <= part.reorderLevel);

    return this.prisma.purchaseOrder.create({
      data: {
        dealerId,
        supplier: dto.supplier,
        lines: {
          create: lowStock.map((part) => ({
            partId: part.id,
            quantityOrdered: Math.max(part.reorderLevel * 2 - part.quantityOnHand, 1),
            unitCost: part.costPrice,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async sendPurchaseOrder(dealerId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, dealerId } });
    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }
    return this.prisma.purchaseOrder.update({ where: { id }, data: { status: PurchaseOrderStatus.SENT, sentAt: new Date() } });
  }

  async receivePurchaseOrderLine(dealerId: string, lineId: string, quantityReceived: number) {
    const line = await this.prisma.purchaseOrderLine.findFirst({
      where: { id: lineId, purchaseOrder: { dealerId } },
      include: { purchaseOrder: { include: { lines: true } } },
    });
    if (!line) {
      throw new NotFoundException('Purchase order line not found');
    }

    await this.prisma.$transaction([
      this.prisma.purchaseOrderLine.update({ where: { id: lineId }, data: { quantityReceived: { increment: quantityReceived } } }),
      this.prisma.part.update({ where: { id: line.partId }, data: { quantityOnHand: { increment: quantityReceived } } }),
      this.prisma.stockMovement.create({
        data: { dealerId, partId: line.partId, type: StockMovementType.GOODS_RECEIVED, quantity: quantityReceived, reference: line.purchaseOrderId },
      }),
    ]);

    const allLines = await this.prisma.purchaseOrderLine.findMany({ where: { purchaseOrderId: line.purchaseOrderId } });
    const fullyReceived = allLines.every((l) => l.quantityReceived + (l.id === lineId ? quantityReceived : 0) >= l.quantityOrdered);
    await this.prisma.purchaseOrder.update({
      where: { id: line.purchaseOrderId },
      data: { status: fullyReceived ? PurchaseOrderStatus.FULLY_RECEIVED : PurchaseOrderStatus.PARTIALLY_RECEIVED },
    });

    return { success: true };
  }

  // --- Reporting (§3.5) ----------------------------------------------------

  async stockValuation(dealerId: string) {
    const parts = await this.prisma.part.findMany({ where: { dealerId } });
    const totalValue = parts.reduce((sum, p) => sum + p.quantityOnHand * Number(p.costPrice), 0);
    return { totalValue, partCount: parts.length };
  }
}

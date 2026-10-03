import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BackorderStatus, StockCountStatus } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AddPriceItemDto,
  CreateBackorderDto,
  CreateStockCountDto,
  CreateSupplierDto,
  UpdateBackorderDto,
  UpdateStockCountLineDto,
  UpdateSupplierDto,
} from './dto/parts-depth.dto';

/**
 * Parts depth (#8) — supplier catalogues/price files, physical stock-takes with variance posting,
 * and backorder tracking, layered on top of the existing basic Parts stock module (which stays as
 * the day-to-day stock ledger).
 */
@Injectable()
export class PartsDepthService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Suppliers & price files ---------------------------------------------

  listSuppliers(dealerId: string) {
    return this.prisma.supplier.findMany({
      where: { dealerId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { priceItems: true } } },
    });
  }

  createSupplier(dealerId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: { dealerId, ...dto } });
  }

  async updateSupplier(dealerId: string, id: string, dto: UpdateSupplierDto) {
    await this.ensureSupplier(dealerId, id);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async listPriceItems(dealerId: string, supplierId: string) {
    await this.ensureSupplier(dealerId, supplierId);
    return this.prisma.supplierPriceItem.findMany({ where: { supplierId }, orderBy: { partNumber: 'asc' } });
  }

  async addPriceItem(dealerId: string, supplierId: string, dto: AddPriceItemDto) {
    await this.ensureSupplier(dealerId, supplierId);
    return this.prisma.supplierPriceItem.create({ data: { supplierId, ...dto } });
  }

  // --- Stock counts ---------------------------------------------------------

  listStockCounts(dealerId: string) {
    return this.prisma.stockCount.findMany({
      where: { dealerId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { lines: true } } },
    });
  }

  /** Opens a stock-take and snapshots every current part as a count line (expected = on-hand). */
  async createStockCount(dealerId: string, dto: CreateStockCountDto, countedBy: string) {
    const parts = await this.prisma.part.findMany({ where: { dealerId }, select: { id: true, quantityOnHand: true } });
    return this.prisma.stockCount.create({
      data: {
        dealerId,
        reference: dto.reference,
        countedBy,
        lines: { create: parts.map((p) => ({ partId: p.id, expectedQty: p.quantityOnHand })) },
      },
      include: { _count: { select: { lines: true } } },
    });
  }

  async getStockCount(dealerId: string, id: string) {
    const count = await this.prisma.stockCount.findFirst({
      where: { id, dealerId },
      include: {
        lines: {
          orderBy: { part: { partNumber: 'asc' } },
          include: { part: { select: { partNumber: true, description: true, quantityOnHand: true } } },
        },
      },
    });
    if (!count) {
      throw new NotFoundException('Stock count not found');
    }
    return count;
  }

  async updateLine(dealerId: string, lineId: string, dto: UpdateStockCountLineDto) {
    const line = await this.prisma.stockCountLine.findFirst({
      where: { id: lineId, stockCount: { dealerId } },
      include: { stockCount: true },
    });
    if (!line) {
      throw new NotFoundException('Stock count line not found');
    }
    if (line.stockCount.status === StockCountStatus.COMPLETED) {
      throw new BadRequestException('This stock count is already completed');
    }
    return this.prisma.stockCountLine.update({ where: { id: lineId }, data: { countedQty: dto.countedQty } });
  }

  /** Completes the count: posts a stock movement for each variance and sets each part to its
   * counted quantity, so the physical count becomes the system truth. */
  async completeStockCount(dealerId: string, id: string) {
    const count = await this.prisma.stockCount.findFirst({
      where: { id, dealerId },
      include: { lines: { include: { part: true } } },
    });
    if (!count) {
      throw new NotFoundException('Stock count not found');
    }
    if (count.status === StockCountStatus.COMPLETED) {
      throw new BadRequestException('Stock count already completed');
    }

    let adjustments = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const line of count.lines) {
        if (line.countedQty === null || line.countedQty === undefined) {
          continue; // uncounted lines are left untouched
        }
        const delta = line.countedQty - line.part.quantityOnHand;
        if (delta === 0) {
          continue;
        }
        await tx.stockMovement.create({
          data: {
            dealerId,
            partId: line.partId,
            type: delta > 0 ? 'GOODS_RECEIVED' : 'WRITE_OFF',
            quantity: Math.abs(delta),
            reasonCode: 'STOCK_COUNT',
            reference: count.reference,
          },
        });
        await tx.part.update({ where: { id: line.partId }, data: { quantityOnHand: line.countedQty } });
        adjustments++;
      }
      await tx.stockCount.update({
        where: { id },
        data: { status: StockCountStatus.COMPLETED, completedAt: new Date() },
      });
    });

    return { completed: true, adjustments };
  }

  // --- Backorders -----------------------------------------------------------

  listBackorders(dealerId: string, status?: BackorderStatus) {
    return this.prisma.partBackorder.findMany({
      where: { dealerId, status: status || undefined },
      orderBy: { createdAt: 'desc' },
      include: { part: { select: { partNumber: true, description: true } } },
    });
  }

  async createBackorder(dealerId: string, dto: CreateBackorderDto) {
    const part = await this.prisma.part.findFirst({ where: { id: dto.partId, dealerId } });
    if (!part) {
      throw new NotFoundException('Part not found');
    }
    return this.prisma.partBackorder.create({
      data: {
        dealerId,
        partId: dto.partId,
        quantity: dto.quantity,
        supplierId: dto.supplierId,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
        reference: dto.reference,
      },
    });
  }

  /** Receiving a backorder books the parts into stock as a goods-received movement. */
  async updateBackorder(dealerId: string, id: string, dto: UpdateBackorderDto) {
    const backorder = await this.prisma.partBackorder.findFirst({ where: { id, dealerId } });
    if (!backorder) {
      throw new NotFoundException('Backorder not found');
    }

    const receiving = dto.status === BackorderStatus.RECEIVED && backorder.status !== BackorderStatus.RECEIVED;
    return this.prisma.$transaction(async (tx) => {
      if (receiving) {
        await tx.stockMovement.create({
          data: {
            dealerId,
            partId: backorder.partId,
            type: 'GOODS_RECEIVED',
            quantity: backorder.quantity,
            reasonCode: 'BACKORDER',
            reference: backorder.reference,
          },
        });
        await tx.part.update({ where: { id: backorder.partId }, data: { quantityOnHand: { increment: backorder.quantity } } });
      }
      return tx.partBackorder.update({
        where: { id },
        data: {
          status: dto.status,
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
        },
      });
    });
  }

  private async ensureSupplier(dealerId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, dealerId } });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return supplier;
  }
}

import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AiInvoiceExtractionService } from './ai-invoice-extraction.service';
import {
  CreateGoodsReceiptNoteDto,
  CreateSupplierDto,
  CreateSupplierInvoiceDto,
  ExtractInvoiceDto,
  UpdateSupplierDto,
} from './dto/purchasing.dto';
import { PurchasingService } from './purchasing.service';

@Controller()
export class PurchasingController {
  constructor(
    private readonly purchasingService: PurchasingService,
    private readonly aiInvoiceExtractionService: AiInvoiceExtractionService,
  ) {}

  @Get('suppliers')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.VIEW })
  listSuppliers(@CurrentUser() user: AuthUser) {
    return this.purchasingService.listSuppliers(user.dealerId);
  }

  @Post('suppliers')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.CREATE })
  createSupplier(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierDto) {
    return this.purchasingService.createSupplier(user.dealerId, dto);
  }

  @Get('suppliers/:id')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.VIEW })
  findSupplier(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.purchasingService.findSupplier(user.dealerId, id);
  }

  @Put('suppliers/:id')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.EDIT })
  updateSupplier(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.purchasingService.updateSupplier(user.dealerId, id, dto);
  }

  @Get('goods-receipt-notes')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.VIEW })
  listGoodsReceiptNotes(@CurrentUser() user: AuthUser) {
    return this.purchasingService.listGoodsReceiptNotes(user.dealerId);
  }

  @Post('goods-receipt-notes')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.EDIT })
  createGoodsReceiptNote(@CurrentUser() user: AuthUser, @Body() dto: CreateGoodsReceiptNoteDto) {
    return this.purchasingService.createGoodsReceiptNote(user.dealerId, dto);
  }

  @Get('goods-receipt-notes/:id')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.VIEW })
  findGoodsReceiptNote(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.purchasingService.findGoodsReceiptNote(user.dealerId, id);
  }

  @Get('supplier-invoices')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.VIEW })
  listSupplierInvoices(@CurrentUser() user: AuthUser) {
    return this.purchasingService.listSupplierInvoices(user.dealerId);
  }

  @Post('supplier-invoices')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.CREATE })
  createSupplierInvoice(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierInvoiceDto) {
    return this.purchasingService.createSupplierInvoice(user.dealerId, dto);
  }

  @Post('supplier-invoices/extract')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.CREATE })
  extractInvoice(@Body() dto: ExtractInvoiceDto) {
    return this.aiInvoiceExtractionService.extract(dto.text);
  }

  @Get('supplier-invoices/:id')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.VIEW })
  findSupplierInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.purchasingService.findSupplierInvoice(user.dealerId, id);
  }

  @Post('supplier-invoices/:id/match')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.EDIT })
  matchInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.purchasingService.matchInvoice(user.dealerId, id);
  }

  @Post('supplier-invoices/:id/approve')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.EDIT })
  approveInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.purchasingService.approveInvoice(user.dealerId, id, user.id);
  }

  @Post('supplier-invoices/:id/pay')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.EDIT })
  markInvoicePaid(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.purchasingService.markInvoicePaid(user.dealerId, id);
  }
}

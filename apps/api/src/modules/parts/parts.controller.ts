import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AllocatePartDto, CreatePartDto, CreatePurchaseOrderDto, CreateStockMovementDto } from './dto/part.dto';
import { PartsService } from './parts.service';

@Controller()
export class PartsController {
  constructor(private readonly partsService: PartsService) {}

  @Get('parts')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.VIEW })
  findAll(@CurrentUser() user: AuthUser, @Query('search') search?: string) {
    return this.partsService.findAll(user.dealerId, search);
  }

  @Get('parts/below-reorder-level')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.VIEW })
  belowReorderLevel(@CurrentUser() user: AuthUser) {
    return this.partsService.belowReorderLevel(user.dealerId);
  }

  @Post('parts')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.CREATE })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePartDto) {
    return this.partsService.create(user.dealerId, dto);
  }

  @Post('parts/movements')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.EDIT })
  recordMovement(@CurrentUser() user: AuthUser, @Body() dto: CreateStockMovementDto) {
    return this.partsService.recordMovement(user.dealerId, dto);
  }

  @Post('parts/allocate')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.EDIT })
  allocate(@CurrentUser() user: AuthUser, @Body() dto: AllocatePartDto) {
    return this.partsService.allocateToJob(user.dealerId, dto);
  }

  @Get('purchase-orders')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.VIEW })
  listPurchaseOrders(@CurrentUser() user: AuthUser) {
    return this.partsService.listPurchaseOrders(user.dealerId);
  }

  @Post('purchase-orders/suggested')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.CREATE })
  generateSuggested(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseOrderDto) {
    return this.partsService.generateSuggestedPurchaseOrder(user.dealerId, dto);
  }

  @Post('purchase-orders/:id/send')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.EDIT })
  send(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.partsService.sendPurchaseOrder(user.dealerId, id);
  }

  @Post('purchase-order-lines/:id/receive')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.EDIT })
  receive(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body('quantityReceived') quantityReceived: number) {
    return this.partsService.receivePurchaseOrderLine(user.dealerId, id, quantityReceived);
  }

  @Get('parts/reports/stock-valuation')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.VIEW })
  stockValuation(@CurrentUser() user: AuthUser) {
    return this.partsService.stockValuation(user.dealerId);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { BackorderStatus, ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  AddPriceItemDto,
  CreateBackorderDto,
  CreateStockCountDto,
  CreateSupplierDto,
  UpdateBackorderDto,
  UpdateStockCountLineDto,
  UpdateSupplierDto,
} from './dto/parts-depth.dto';
import { PartsDepthService } from './parts-depth.service';

@Controller()
export class PartsDepthController {
  constructor(private readonly service: PartsDepthService) {}

  // --- Suppliers ------------------------------------------------------------

  @Get('suppliers')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.VIEW })
  listSuppliers(@CurrentUser() user: AuthUser) {
    return this.service.listSuppliers(user.dealerId);
  }

  @Post('suppliers')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.CREATE })
  createSupplier(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierDto) {
    return this.service.createSupplier(user.dealerId, dto);
  }

  @Patch('suppliers/:id')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.EDIT })
  updateSupplier(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.service.updateSupplier(user.dealerId, id, dto);
  }

  @Get('suppliers/:id/price-items')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.VIEW })
  listPriceItems(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.listPriceItems(user.dealerId, id);
  }

  @Post('suppliers/:id/price-items')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.EDIT })
  addPriceItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddPriceItemDto) {
    return this.service.addPriceItem(user.dealerId, id, dto);
  }

  // --- Stock counts ---------------------------------------------------------

  @Get('stock-counts')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.VIEW })
  listStockCounts(@CurrentUser() user: AuthUser) {
    return this.service.listStockCounts(user.dealerId);
  }

  @Post('stock-counts')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.CREATE })
  createStockCount(@CurrentUser() user: AuthUser, @Body() dto: CreateStockCountDto) {
    return this.service.createStockCount(user.dealerId, dto, `${user.firstName} ${user.lastName}`);
  }

  @Get('stock-counts/:id')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.VIEW })
  getStockCount(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getStockCount(user.dealerId, id);
  }

  @Patch('stock-count-lines/:id')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.EDIT })
  updateLine(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateStockCountLineDto) {
    return this.service.updateLine(user.dealerId, id, dto);
  }

  @Post('stock-counts/:id/complete')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.EDIT })
  completeStockCount(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.completeStockCount(user.dealerId, id);
  }

  // --- Backorders -----------------------------------------------------------

  @Get('part-backorders')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.VIEW })
  listBackorders(@CurrentUser() user: AuthUser, @Query('status') status?: BackorderStatus) {
    return this.service.listBackorders(user.dealerId, status);
  }

  @Post('part-backorders')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.CREATE })
  createBackorder(@CurrentUser() user: AuthUser, @Body() dto: CreateBackorderDto) {
    return this.service.createBackorder(user.dealerId, dto);
  }

  @Patch('part-backorders/:id')
  @RequirePermissions({ module: ModuleKey.PARTS, action: PermissionAction.EDIT })
  updateBackorder(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateBackorderDto) {
    return this.service.updateBackorder(user.dealerId, id, dto);
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AddDealProductDto, CreateFinanceProductDto, RecordDisclosureDto } from './dto/fi.dto';
import { FiService } from './fi.service';

@Controller('fi')
export class FiController {
  constructor(private readonly fiService: FiService) {}

  @Get('products')
  @RequirePermissions({ module: ModuleKey.FI, action: PermissionAction.VIEW })
  listProducts(@CurrentUser() user: AuthUser) {
    return this.fiService.listProducts(user.dealerId);
  }

  @Post('products')
  @RequirePermissions({ module: ModuleKey.FI, action: PermissionAction.CREATE })
  createProduct(@CurrentUser() user: AuthUser, @Body() dto: CreateFinanceProductDto) {
    return this.fiService.createProduct(user.dealerId, dto);
  }

  @Post('deal-products')
  @RequirePermissions({ module: ModuleKey.FI, action: PermissionAction.CREATE })
  addToDeal(@CurrentUser() user: AuthUser, @Body() dto: AddDealProductDto) {
    return this.fiService.addToDeal(user.dealerId, dto);
  }

  @Post('deal-products/:id/disclosure')
  @RequirePermissions({ module: ModuleKey.FI, action: PermissionAction.CREATE })
  recordDisclosure(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RecordDisclosureDto) {
    return this.fiService.recordDisclosure(user.dealerId, id, dto);
  }

  @Get('reports/commission')
  @RequirePermissions({ module: ModuleKey.FI, action: PermissionAction.VIEW })
  commissionReport(@CurrentUser() user: AuthUser) {
    return this.fiService.commissionReport(user.dealerId);
  }
}

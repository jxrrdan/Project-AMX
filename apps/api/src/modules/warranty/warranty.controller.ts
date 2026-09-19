import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ModuleKey, PermissionAction, WarrantyClaimStatus } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  CreateOperationLineDto,
  CreateWarrantyClaimDto,
  UpdateClaimStatusDto,
  UpdateOperationLineDto,
} from './dto/warranty.dto';
import { WarrantyService } from './warranty.service';

@Controller('warranty-claims')
export class WarrantyController {
  constructor(private readonly warrantyService: WarrantyService) {}

  @Get()
  @RequirePermissions({ module: ModuleKey.WARRANTY, action: PermissionAction.VIEW })
  findAll(@CurrentUser() user: AuthUser, @Query('status') status?: WarrantyClaimStatus) {
    return this.warrantyService.findAll(user.dealerId, status);
  }

  @Get('reports/rejection-rate')
  @RequirePermissions({ module: ModuleKey.WARRANTY, action: PermissionAction.VIEW })
  rejectionRate(@CurrentUser() user: AuthUser) {
    return this.warrantyService.rejectionRateReport(user.dealerId);
  }

  @Get(':id')
  @RequirePermissions({ module: ModuleKey.WARRANTY, action: PermissionAction.VIEW })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.warrantyService.findOne(user.dealerId, id);
  }

  @Post()
  @RequirePermissions({ module: ModuleKey.WARRANTY, action: PermissionAction.CREATE })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWarrantyClaimDto) {
    return this.warrantyService.create(user.dealerId, dto);
  }

  @Post(':id/operation-lines')
  @RequirePermissions({ module: ModuleKey.WARRANTY, action: PermissionAction.CREATE })
  addLine(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateOperationLineDto) {
    return this.warrantyService.addOperationLine(user.dealerId, id, dto);
  }

  @Patch('operation-lines/:lineId')
  @RequirePermissions({ module: ModuleKey.WARRANTY, action: PermissionAction.EDIT })
  updateLine(@CurrentUser() user: AuthUser, @Param('lineId') lineId: string, @Body() dto: UpdateOperationLineDto) {
    return this.warrantyService.updateOperationLine(user.dealerId, lineId, dto);
  }

  @Post('operation-lines/:lineId/clock-on')
  @RequirePermissions({ module: ModuleKey.WARRANTY, action: PermissionAction.EDIT })
  clockOn(@CurrentUser() user: AuthUser, @Param('lineId') lineId: string) {
    return this.warrantyService.clockOn(user.dealerId, lineId, user.id);
  }

  @Post('operation-lines/:lineId/clock-off')
  @RequirePermissions({ module: ModuleKey.WARRANTY, action: PermissionAction.EDIT })
  clockOff(@CurrentUser() user: AuthUser, @Param('lineId') lineId: string) {
    return this.warrantyService.clockOff(user.dealerId, lineId, user.id);
  }

  @Post('operation-lines/:lineId/approve')
  @RequirePermissions({ module: ModuleKey.WARRANTY, action: PermissionAction.APPROVE })
  approveLine(@CurrentUser() user: AuthUser, @Param('lineId') lineId: string) {
    return this.warrantyService.approveLine(user.dealerId, lineId, `${user.firstName} ${user.lastName}`);
  }

  @Patch(':id/status')
  @RequirePermissions({ module: ModuleKey.WARRANTY, action: PermissionAction.EDIT })
  updateStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateClaimStatusDto) {
    return this.warrantyService.updateStatus(user.dealerId, id, dto);
  }
}

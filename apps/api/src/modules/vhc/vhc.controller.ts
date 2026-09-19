import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AddVhcItemDto, CreateVhcInspectionDto, RespondToItemDto } from './dto/vhc.dto';
import { VhcService } from './vhc.service';

@Controller('vhc')
export class VhcController {
  constructor(private readonly vhcService: VhcService) {}

  @Get('inspections')
  @RequirePermissions({ module: ModuleKey.VHC, action: PermissionAction.VIEW })
  listInspections(@CurrentUser() user: AuthUser) {
    return this.vhcService.listInspections(user.dealerId);
  }

  @Post('inspections')
  @RequirePermissions({ module: ModuleKey.VHC, action: PermissionAction.CREATE })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVhcInspectionDto) {
    return this.vhcService.createInspection(user.dealerId, user.id, dto);
  }

  /** Public customer-facing report page (§9.2) — no login required. */
  @Public()
  @Get('inspections/:id/report')
  findPublic(@Param('id') id: string) {
    return this.vhcService.findPublic(id);
  }

  @Get('inspections/:id')
  @RequirePermissions({ module: ModuleKey.VHC, action: PermissionAction.VIEW })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vhcService.findOne(user.dealerId, id);
  }

  @Post('inspections/:id/items')
  @RequirePermissions({ module: ModuleKey.VHC, action: PermissionAction.CREATE })
  addItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddVhcItemDto) {
    return this.vhcService.addItem(user.dealerId, id, dto);
  }

  @Post('inspections/:id/send')
  @RequirePermissions({ module: ModuleKey.VHC, action: PermissionAction.EDIT })
  sendReport(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body('customerEmail') customerEmail: string) {
    return this.vhcService.sendReport(user.dealerId, id, customerEmail);
  }

  /** Customer approves/declines on the report page — no login required (§9.3). */
  @Public()
  @Patch('items/:id/respond')
  respondToItem(@Param('id') id: string, @Body() dto: RespondToItemDto) {
    return this.vhcService.respondToItem(id, dto);
  }

  @Get('reports/conversion-rate')
  @RequirePermissions({ module: ModuleKey.VHC, action: PermissionAction.VIEW })
  conversionRate(@CurrentUser() user: AuthUser) {
    return this.vhcService.conversionRate(user.dealerId);
  }
}

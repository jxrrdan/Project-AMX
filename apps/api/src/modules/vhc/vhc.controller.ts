import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  AddVhcItemDto,
  AddVhcItemPartDto,
  CreateVhcInspectionDto,
  LogPhoneContactDto,
  RecordInspectionDto,
  RespondToItemDto,
} from './dto/vhc.dto';
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

  /** Links a real stocked part to an item, refining its auto-quote (§ VHC auto-quote) from an actual price. */
  @Post('items/:id/parts')
  @RequirePermissions({ module: ModuleKey.VHC, action: PermissionAction.EDIT })
  addItemPart(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddVhcItemPartDto) {
    return this.vhcService.addItemPart(user.dealerId, id, dto);
  }

  @Delete('item-parts/:id')
  @RequirePermissions({ module: ModuleKey.VHC, action: PermissionAction.EDIT })
  removeItemPart(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vhcService.removeItemPart(user.dealerId, id);
  }

  /** Technician sign-off — marks the inspection recorded/videoed, required before the report can
   * be sent, and notifies the job card's assigned service advisor (§ VHC advisor workflow). */
  @Post('inspections/:id/record')
  @RequirePermissions({ module: ModuleKey.VHC, action: PermissionAction.EDIT })
  recordInspection(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RecordInspectionDto) {
    return this.vhcService.recordInspection(user.dealerId, id, user.id, dto);
  }

  @Post('inspections/:id/send')
  @RequirePermissions({ module: ModuleKey.VHC, action: PermissionAction.EDIT })
  sendReport(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body('customerEmail') customerEmail: string) {
    return this.vhcService.sendReport(user.dealerId, id, customerEmail);
  }

  /** Advisor rang the customer instead of emailing (§ VHC advisor workflow). */
  @Post('inspections/:id/log-call')
  @RequirePermissions({ module: ModuleKey.VHC, action: PermissionAction.EDIT })
  logPhoneContact(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: LogPhoneContactDto) {
    return this.vhcService.logPhoneContact(user.dealerId, id, dto);
  }

  /** Customer approves/declines/defers on the public report page — no login required (§9.3). */
  @Public()
  @Patch('items/:id/respond')
  respondToItem(@Param('id') id: string, @Body() dto: RespondToItemDto) {
    return this.vhcService.respondToItem(id, dto);
  }

  /** Same tri-state response, but for an advisor logging the customer's verbal decision from a phone call. */
  @Patch('items/:id/advisor-respond')
  @RequirePermissions({ module: ModuleKey.VHC, action: PermissionAction.EDIT })
  respondToItemAsAdvisor(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RespondToItemDto) {
    return this.vhcService.respondToItemAsAdvisor(user.dealerId, id, dto);
  }

  /** Deletes an item logged in error — only while still pending (§ VHC defer/delete). */
  @Delete('items/:id')
  @RequirePermissions({ module: ModuleKey.VHC, action: PermissionAction.EDIT })
  removeItem(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vhcService.removeItem(user.dealerId, id);
  }

  @Get('reports/conversion-rate')
  @RequirePermissions({ module: ModuleKey.VHC, action: PermissionAction.VIEW })
  conversionRate(@CurrentUser() user: AuthUser) {
    return this.vhcService.conversionRate(user.dealerId);
  }
}

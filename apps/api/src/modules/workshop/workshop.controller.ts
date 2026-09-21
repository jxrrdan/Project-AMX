import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateConditionReportDto } from '../vehicle-condition/dto/condition-report.dto';
import { VehicleConditionService } from '../vehicle-condition/vehicle-condition.service';
import { CreateBayDto, CreateJobCardDto, SetCapacityDto, UpdateJobCardDto } from './dto/job-card.dto';
import { CreateJobCardOperationLineDto } from './dto/operation-line.dto';
import { CreatePartRequirementDto } from './dto/part-requirement.dto';
import { CreateServiceBookingDto } from './dto/service-booking.dto';
import { WorkshopService } from './workshop.service';

@Controller()
export class WorkshopController {
  constructor(
    private readonly workshopService: WorkshopService,
    private readonly vehicleConditionService: VehicleConditionService,
  ) {}

  @Get('bays')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW })
  listBays(@CurrentUser() user: AuthUser) {
    return this.workshopService.listBays(user.dealerId);
  }

  @Post('bays')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.CREATE })
  createBay(@CurrentUser() user: AuthUser, @Body() dto: CreateBayDto) {
    return this.workshopService.createBay(user.dealerId, dto);
  }

  @Get('job-cards')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW })
  listJobCards(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('bayId') bayId?: string,
    @Query('technicianId') technicianId?: string,
  ) {
    return this.workshopService.listJobCards(user.dealerId, from, to, bayId, technicianId);
  }

  @Post('job-cards')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.CREATE })
  createJobCard(@CurrentUser() user: AuthUser, @Body() dto: CreateJobCardDto) {
    return this.workshopService.createJobCard(user.dealerId, dto, user.id);
  }

  /** Literal segment — must come before ':id'-based routes below. */
  @Get('job-cards/upcoming-part-shortfalls')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW })
  upcomingPartShortfalls(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.workshopService.upcomingPartsShortfalls(user.dealerId, days ? Number(days) : undefined);
  }

  @Get('job-cards/:id')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW })
  getJobCard(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workshopService.getJobCard(user.dealerId, id);
  }

  @Patch('job-cards/:id')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  updateJobCard(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateJobCardDto) {
    return this.workshopService.updateJobCard(user.dealerId, id, dto, user.id);
  }

  @Get('job-cards/:id/part-requirements')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW })
  listPartRequirements(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workshopService.listPartRequirements(user.dealerId, id);
  }

  @Post('job-cards/:id/part-requirements')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  addPartRequirement(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreatePartRequirementDto) {
    return this.workshopService.addPartRequirement(user.dealerId, id, dto);
  }

  @Delete('part-requirements/:id')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  removePartRequirement(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workshopService.removePartRequirement(user.dealerId, id);
  }

  @Get('job-cards/:id/condition-checks')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW })
  listConditionChecks(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vehicleConditionService.listForJobCard(user.dealerId, id);
  }

  /** Itemised condition/damage check — INITIAL at drop-off, FINAL at handback. */
  @Post('job-cards/:id/condition-checks')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  recordConditionCheck(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateConditionReportDto) {
    return this.vehicleConditionService.recordForJobCard(user.dealerId, id, dto);
  }

  @Post('job-cards/:id/clock-on')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  clockOn(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workshopService.clockOn(user.dealerId, id, user.id);
  }

  @Post('job-cards/:id/clock-off')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  clockOff(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workshopService.clockOff(user.dealerId, id, user.id);
  }

  @Get('job-cards/:id/operation-lines')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW })
  listOperationLines(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workshopService.listOperationLines(user.dealerId, id);
  }

  @Post('job-cards/:id/operation-lines')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  addOperationLine(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateJobCardOperationLineDto) {
    return this.workshopService.addOperationLine(user.dealerId, id, dto);
  }

  @Post('operation-lines/:lineId/clock-on')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  clockOnLine(@CurrentUser() user: AuthUser, @Param('lineId') lineId: string) {
    return this.workshopService.clockOnLine(user.dealerId, lineId, user.id);
  }

  @Post('operation-lines/:lineId/clock-off')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  clockOffLine(@CurrentUser() user: AuthUser, @Param('lineId') lineId: string) {
    return this.workshopService.clockOffLine(user.dealerId, lineId, user.id);
  }

  /**
   * Token-based read-only URL for the workshop TV board (Feature Spec §2.3) — no login required.
   * Gated by a dedicated unguessable `workshopBoardToken` (see GET /dealers/me), never the
   * dealer's own id, which this app already publishes elsewhere (public widget URLs).
   */
  @Public()
  @Get('workshop-board/:boardToken')
  getBoard(@Param('boardToken') boardToken: string) {
    return this.workshopService.getPublicBoard(boardToken);
  }

  @Get('capacity')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW })
  listCapacity(@CurrentUser() user: AuthUser, @Query('from') from: string, @Query('to') to: string) {
    return this.workshopService.listCapacity(user.dealerId, from, to);
  }

  @Post('capacity')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  setCapacity(@CurrentUser() user: AuthUser, @Body() dto: SetCapacityDto) {
    return this.workshopService.setCapacity(user.dealerId, dto);
  }

  /** Workshop loading — booked hours vs configured capacity, per bay per day. */
  @Get('loading')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW })
  loadingReport(@CurrentUser() user: AuthUser, @Query('from') from: string, @Query('to') to: string) {
    return this.workshopService.loadingReport(user.dealerId, from, to);
  }

  @Get('service-bookings')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW })
  listServiceBookings(@CurrentUser() user: AuthUser) {
    return this.workshopService.listServiceBookings(user.dealerId);
  }

  /** Public booking widget endpoint — embeddable on the dealer website (Feature Spec §2.5). */
  @Public()
  @Post('dealers/:dealerId/service-bookings')
  createServiceBooking(@Param('dealerId') dealerId: string, @Body() dto: CreateServiceBookingDto) {
    return this.workshopService.createServiceBooking(dealerId, dto);
  }

  @Patch('service-bookings/:id/confirm')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  confirmServiceBooking(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workshopService.confirmServiceBooking(user.dealerId, id);
  }
}

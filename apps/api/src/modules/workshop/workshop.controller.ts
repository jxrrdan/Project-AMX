import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateBayDto, CreateJobCardDto, SetCapacityDto, UpdateJobCardDto } from './dto/job-card.dto';
import { CreateServiceBookingDto } from './dto/service-booking.dto';
import { WorkshopService } from './workshop.service';

@Controller()
export class WorkshopController {
  constructor(private readonly workshopService: WorkshopService) {}

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

  @Patch('job-cards/:id')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  updateJobCard(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateJobCardDto) {
    return this.workshopService.updateJobCard(user.dealerId, id, dto, user.id);
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

  /** Token-based read-only URL for the workshop TV board (Feature Spec §2.3) — no login required. */
  @Public()
  @Get('workshop-board/:dealerId')
  getBoard(@Param('dealerId') dealerId: string) {
    return this.workshopService.listJobCards(dealerId);
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

import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ModuleKey, OnlineBookingStatus, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateOnlineBookingDto, UpdateOnlineBookingDto } from './dto/online-booking.dto';
import { OnlineBookingService } from './online-booking.service';

@Controller()
export class OnlineBookingController {
  constructor(private readonly service: OnlineBookingService) {}

  /** Public portal submission — the dealer's own site / a QR code points customers here. */
  @Public()
  @Post('public/booking/:dealerId')
  createPublic(@Param('dealerId') dealerId: string, @Body() dto: CreateOnlineBookingDto) {
    return this.service.createPublic(dealerId, dto);
  }

  @Get('online-bookings')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW })
  findAll(@CurrentUser() user: AuthUser, @Query('status') status?: OnlineBookingStatus) {
    return this.service.findAll(user.dealerId, status);
  }

  @Patch('online-bookings/:id')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  updateStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOnlineBookingDto) {
    return this.service.updateStatus(user.dealerId, id, dto);
  }
}

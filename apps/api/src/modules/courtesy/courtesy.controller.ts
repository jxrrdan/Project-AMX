import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateBookingDto, CreateCourtesyVehicleDto, ReturnBookingDto } from './dto/courtesy.dto';
import { CourtesyService } from './courtesy.service';

@Controller('courtesy-fleet')
export class CourtesyController {
  constructor(private readonly courtesyService: CourtesyService) {}

  @Get('vehicles')
  @RequirePermissions({ module: ModuleKey.COURTESY_FLEET, action: PermissionAction.VIEW })
  listFleet(@CurrentUser() user: AuthUser) {
    return this.courtesyService.listFleet(user.dealerId);
  }

  @Post('vehicles')
  @RequirePermissions({ module: ModuleKey.COURTESY_FLEET, action: PermissionAction.CREATE })
  createVehicle(@CurrentUser() user: AuthUser, @Body() dto: CreateCourtesyVehicleDto) {
    return this.courtesyService.createVehicle(user.dealerId, dto);
  }

  @Get('vehicles/expiry-alerts')
  @RequirePermissions({ module: ModuleKey.COURTESY_FLEET, action: PermissionAction.VIEW })
  expiryAlerts(@CurrentUser() user: AuthUser) {
    return this.courtesyService.expiryAlerts(user.dealerId);
  }

  @Post('bookings')
  @RequirePermissions({ module: ModuleKey.COURTESY_FLEET, action: PermissionAction.CREATE })
  createBooking(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
    return this.courtesyService.createBooking(user.dealerId, dto);
  }

  @Post('bookings/:id/return')
  @RequirePermissions({ module: ModuleKey.COURTESY_FLEET, action: PermissionAction.EDIT })
  returnBooking(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReturnBookingDto) {
    return this.courtesyService.returnBooking(user.dealerId, id, dto);
  }

  @Get('reports/utilisation')
  @RequirePermissions({ module: ModuleKey.COURTESY_FLEET, action: PermissionAction.VIEW })
  utilisation(@CurrentUser() user: AuthUser) {
    return this.courtesyService.utilisationReport(user.dealerId);
  }
}

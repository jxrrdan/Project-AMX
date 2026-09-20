import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateConditionReportDto } from '../vehicle-condition/dto/condition-report.dto';
import { VehicleConditionService } from '../vehicle-condition/vehicle-condition.service';
import { CreateBookingDto, CreateCourtesyVehicleDto, ReturnBookingDto } from './dto/courtesy.dto';
import { CourtesyService } from './courtesy.service';

@Controller('courtesy-fleet')
export class CourtesyController {
  constructor(
    private readonly courtesyService: CourtesyService,
    private readonly vehicleConditionService: VehicleConditionService,
  ) {}

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

  @Get('bookings/:id/condition-checks')
  @RequirePermissions({ module: ModuleKey.COURTESY_FLEET, action: PermissionAction.VIEW })
  listConditionChecks(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vehicleConditionService.listForCourtesyBooking(user.dealerId, id);
  }

  /** Itemised condition/damage check — INITIAL when the car leaves with the customer, FINAL when returned. */
  @Post('bookings/:id/condition-checks')
  @RequirePermissions({ module: ModuleKey.COURTESY_FLEET, action: PermissionAction.CREATE })
  recordConditionCheck(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateConditionReportDto) {
    return this.vehicleConditionService.recordForCourtesyBooking(user.dealerId, id, dto);
  }
}

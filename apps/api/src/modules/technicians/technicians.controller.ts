import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { SetTechnicianAvailabilityDto, SetTechnicianSkillsDto } from './dto/technician.dto';
import { TechniciansService } from './technicians.service';

/** Gated under ModuleKey.WORKSHOP — technician capacity planning is part of workshop scheduling,
 * and WORKSHOP_CONTROLLER/SERVICE_ADVISOR/TECHNICIAN roles already hold that module's permissions. */
@Controller('technicians')
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Get()
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW })
  listTechnicians(@CurrentUser() user: AuthUser) {
    return this.techniciansService.listTechnicians(user.dealerId);
  }

  @Put(':userId/skills')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  setSkills(@CurrentUser() user: AuthUser, @Param('userId') userId: string, @Body() dto: SetTechnicianSkillsDto) {
    return this.techniciansService.setSkills(user.dealerId, userId, dto);
  }

  @Get('availability')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW })
  listAvailability(@CurrentUser() user: AuthUser, @Query('from') from: string, @Query('to') to: string) {
    return this.techniciansService.listAvailability(user.dealerId, from, to);
  }

  @Post('availability')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  setAvailability(@CurrentUser() user: AuthUser, @Body() dto: SetTechnicianAvailabilityDto) {
    return this.techniciansService.setAvailability(user.dealerId, dto);
  }

  @Get('capacity-report')
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW })
  capacityReport(@CurrentUser() user: AuthUser, @Query('from') from: string, @Query('to') to: string) {
    return this.techniciansService.capacityReport(user.dealerId, from, to);
  }
}

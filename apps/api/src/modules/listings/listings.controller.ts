import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { SetPlatformDto } from './dto/listing.dto';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get('platforms')
  @RequirePermissions({ module: ModuleKey.LISTINGS, action: PermissionAction.VIEW })
  listPlatforms(@CurrentUser() user: AuthUser) {
    return this.listingsService.listPlatforms(user.dealerId);
  }

  @Post('platforms')
  @RequirePermissions({ module: ModuleKey.LISTINGS, action: PermissionAction.EDIT })
  setPlatform(@CurrentUser() user: AuthUser, @Body() dto: SetPlatformDto) {
    return this.listingsService.setPlatform(user.dealerId, dto);
  }

  @Post('vehicles/:usedVehicleId/publish')
  @RequirePermissions({ module: ModuleKey.LISTINGS, action: PermissionAction.CREATE })
  publish(@CurrentUser() user: AuthUser, @Param('usedVehicleId') usedVehicleId: string) {
    return this.listingsService.publishVehicle(user.dealerId, usedVehicleId);
  }

  @Get('vehicles/:usedVehicleId')
  @RequirePermissions({ module: ModuleKey.LISTINGS, action: PermissionAction.VIEW })
  listForVehicle(@CurrentUser() user: AuthUser, @Param('usedVehicleId') usedVehicleId: string) {
    return this.listingsService.listForVehicle(user.dealerId, usedVehicleId);
  }

  @Post('vehicles/:usedVehicleId/platforms/:platformId/resync')
  @RequirePermissions({ module: ModuleKey.LISTINGS, action: PermissionAction.EDIT })
  resync(
    @CurrentUser() user: AuthUser,
    @Param('usedVehicleId') usedVehicleId: string,
    @Param('platformId') platformId: string,
  ) {
    return this.listingsService.resync(user.dealerId, usedVehicleId, platformId);
  }
}

import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DealersService } from './dealers.service';
import { SetModuleLicenseDto, UpdateDealerDto } from './dto/dealer.dto';

@Controller('dealers/me')
export class DealersController {
  constructor(private readonly dealersService: DealersService) {}

  @Get()
  findOne(@CurrentUser() user: AuthUser) {
    return this.dealersService.findOne(user.dealerId);
  }

  @Patch()
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.EDIT })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateDealerDto) {
    return this.dealersService.update(user.dealerId, dto);
  }

  @Post('module-licenses')
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.EDIT })
  setModuleLicense(@CurrentUser() user: AuthUser, @Body() dto: SetModuleLicenseDto) {
    return this.dealersService.setModuleLicense(user.dealerId, dto);
  }

  /** Revokes the current workshop TV board link (e.g. if it was shared inappropriately) and issues a new one. */
  @Post('workshop-board-token/regenerate')
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.EDIT })
  regenerateBoardToken(@CurrentUser() user: AuthUser) {
    return this.dealersService.regenerateBoardToken(user.dealerId);
  }
}

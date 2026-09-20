import { Body, Controller, Get, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AssignDealerFranchiseDto, CreateFranchiseDto, CreateGroupDto } from './dto/org.dto';
import { OrgService } from './org.service';

const MODULE = ModuleKey.ADMIN;

@Controller('org')
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  /** The caller's own franchise/group (with their join codes to share with sibling dealers) — never a directory of every org. */
  @Get('my-org')
  @RequirePermissions({ module: MODULE, action: PermissionAction.VIEW })
  myOrg(@CurrentUser() user: AuthUser) {
    return this.orgService.myOrg(user.dealerId);
  }

  @Post('groups')
  @RequirePermissions({ module: MODULE, action: PermissionAction.EDIT })
  createGroup(@Body() dto: CreateGroupDto) {
    return this.orgService.createGroup(dto);
  }

  @Post('franchises')
  @RequirePermissions({ module: MODULE, action: PermissionAction.EDIT })
  createFranchise(@Body() dto: CreateFranchiseDto) {
    return this.orgService.createFranchise(dto);
  }

  /** Self-service: assigns the CALLER's own dealer to a franchise by its join code (or clears it if omitted). */
  @Post('my-dealer/franchise')
  @RequirePermissions({ module: MODULE, action: PermissionAction.EDIT })
  assignMyDealerFranchise(@CurrentUser() user: AuthUser, @Body() dto: AssignDealerFranchiseDto) {
    return this.orgService.assignDealerFranchise(user.dealerId, dto);
  }
}

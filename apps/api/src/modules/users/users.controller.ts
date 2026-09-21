import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AcceptInvitationDto, InviteUserDto, UpdateMyProfileDto, UpdateUserDto } from './dto/user.dto';
import { UsersService } from './users.service';
import type { AuthUser } from '@project-amx/shared';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.VIEW })
  findAll(@CurrentUser() user: AuthUser) {
    return this.usersService.findAll(user.dealerId);
  }

  @Post('invite')
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.CREATE })
  invite(@CurrentUser() user: AuthUser, @Body() dto: InviteUserDto) {
    return this.usersService.invite(user.dealerId, dto);
  }

  @Public()
  @Post('accept-invitation')
  acceptInvitation(@Body() dto: AcceptInvitationDto) {
    return this.usersService.acceptInvitation(dto);
  }

  /** Literal segment — must come before the ':id' wildcard route below. */
  @Patch('me')
  updateMyProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateMyProfileDto) {
    return this.usersService.updateMyProfile(user.id, dto);
  }

  @Patch(':id')
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.EDIT })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.dealerId, id, dto, user.id, user.permissions);
  }

  @Post(':id/force-logout')
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.EDIT })
  forceLogout(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.forceLogout(user.dealerId, id);
  }
}

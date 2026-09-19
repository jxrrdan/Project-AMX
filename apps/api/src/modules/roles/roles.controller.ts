import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.VIEW })
  findAll(@CurrentUser() user: AuthUser) {
    return this.rolesService.findAll(user.dealerId);
  }

  @Post()
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.CREATE })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(user.dealerId, dto, user.permissions);
  }

  @Patch(':id')
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.EDIT })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(user.dealerId, id, dto, user.permissions);
  }

  @Delete(':id')
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.DELETE })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rolesService.remove(user.dealerId, id);
  }
}

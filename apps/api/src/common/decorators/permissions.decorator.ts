import { SetMetadata } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';

export const PERMISSIONS_KEY = 'permissions';

export interface RequiredPermission {
  module: ModuleKey;
  action: PermissionAction;
}

/** Declares the module+action a route requires; enforced by PermissionsGuard against the caller's role/override grants. */
export const RequirePermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

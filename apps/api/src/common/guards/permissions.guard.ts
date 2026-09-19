import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '@project-amx/shared';
import { PERMISSIONS_KEY, RequiredPermission } from '../decorators/permissions.decorator';

/**
 * Enforces Feature Spec §7.2's two-tier RBAC: a route lists the module+action it needs via
 * @RequirePermissions, and this guard checks the caller's resolved permission set (role grants
 * merged with per-user module overrides — see JwtStrategy.validate).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('No authenticated user');
    }

    const hasAll = required.every((need) =>
      user.permissions.some((p) => p.module === need.module && p.action === need.action),
    );

    if (!hasAll) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }

    return true;
  }
}

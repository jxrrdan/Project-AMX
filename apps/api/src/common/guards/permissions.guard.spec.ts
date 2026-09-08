import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import { PermissionsGuard } from './permissions.guard';

function makeContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  it('allows the request when no permissions are required', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });

  it('allows a user who holds the required permission', () => {
    const reflector = {
      getAllAndOverride: () => [{ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW }],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const user = { permissions: [{ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW }] };
    expect(guard.canActivate(makeContext(user))).toBe(true);
  });

  it('rejects a user missing the required permission', () => {
    const reflector = {
      getAllAndOverride: () => [{ module: ModuleKey.ADMIN, action: PermissionAction.DELETE }],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const user = { permissions: [{ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW }] };
    expect(() => guard.canActivate(makeContext(user))).toThrow(ForbiddenException);
  });

  it('rejects when there is no authenticated user at all', () => {
    const reflector = {
      getAllAndOverride: () => [{ module: ModuleKey.ADMIN, action: PermissionAction.VIEW }],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});

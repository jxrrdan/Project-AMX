import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AuthUser, ModuleKey, PermissionAction } from '@project-amx/shared';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  dealerId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  /** Re-fetches roles/permissions on every request so a revoked role takes effect immediately. */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: { include: { role: { include: { permissions: true } } } },
        moduleOverrides: true,
      },
    });

    if (!user || !user.active || user.dealerId !== payload.dealerId) {
      throw new UnauthorizedException();
    }

    const rolePermissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((p) => ({
        module: p.module as ModuleKey,
        action: p.action as PermissionAction,
      })),
    );

    const overrideDenies = new Set(
      user.moduleOverrides
        .filter((o) => !o.allowed)
        .map((o) => `${o.module}:${o.action}`),
    );
    const overrideGrants = user.moduleOverrides
      .filter((o) => o.allowed)
      .map((o) => ({ module: o.module as ModuleKey, action: o.action as PermissionAction }));

    const permissions = [...rolePermissions, ...overrideGrants].filter(
      (p) => !overrideDenies.has(`${p.module}:${p.action}`),
    );

    return {
      id: user.id,
      dealerId: user.dealerId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles.map((ur) => ur.role.name),
      permissions,
    };
  }
}

import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthUser, ModuleKey, PermissionAction } from '@project-amx/shared';
import * as bcrypt from 'bcrypt';
import { addDays } from 'date-fns';
import { authenticator } from 'otplib';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseDurationToSeconds } from '../../common/util/duration.util';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const dealer = await this.prisma.dealer.findUnique({ where: { subdomain: dto.subdomain } });
    if (!dealer) {
      throw new UnauthorizedException('Unknown dealer');
    }

    const user = await this.prisma.user.findUnique({
      where: { dealerId_email: { dealerId: dealer.id, email: dto.email } },
      include: { roles: { include: { role: { include: { permissions: true } } } }, moduleOverrides: true },
    });

    const passwordOk = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;

    if (!user || !user.active || !passwordOk) {
      await this.prisma.loginAudit.create({
        data: { userId: user?.id, email: dto.email, success: false, ipAddress, userAgent },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.mfaEnabled) {
      if (!dto.totpCode) {
        throw new ForbiddenException('MFA_REQUIRED');
      }
      const valid = authenticator.check(dto.totpCode, user.mfaSecret ?? '');
      if (!valid) {
        await this.prisma.loginAudit.create({
          data: { userId: user.id, email: dto.email, success: false, ipAddress, userAgent },
        });
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      this.prisma.loginAudit.create({
        data: { userId: user.id, email: dto.email, success: true, ipAddress, userAgent },
      }),
    ]);

    const authUser = this.toAuthUser(user);
    return this.issueTokens(authUser, ipAddress, userAgent);
  }

  async refresh(refreshToken: string) {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken },
      include: {
        user: {
          include: { roles: { include: { role: { include: { permissions: true } } } }, moduleOverrides: true },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const authUser = this.toAuthUser(session.user);
    return this.issueTokens(authUser);
  }

  async logout(refreshToken: string) {
    await this.prisma.userSession.updateMany({
      where: { refreshToken },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(user: AuthUser, ipAddress?: string, userAgent?: string) {
    const accessToken = this.jwt.sign(
      { sub: user.id, dealerId: user.dealerId },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: parseDurationToSeconds(this.config.get<string>('JWT_ACCESS_EXPIRY', '15m')),
      },
    );

    const refreshToken = randomUUID();
    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken,
        ipAddress,
        userAgent,
        expiresAt: addDays(new Date(), 7),
      },
    });

    return { accessToken, refreshToken, user };
  }

  private toAuthUser(user: {
    id: string;
    dealerId: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: { role: { name: string; permissions: { module: string; action: string }[] } }[];
    moduleOverrides: { module: string; action: string; allowed: boolean }[];
  }): AuthUser {
    const rolePermissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((p) => ({
        module: p.module as ModuleKey,
        action: p.action as PermissionAction,
      })),
    );
    const overrideDenies = new Set(
      user.moduleOverrides.filter((o) => !o.allowed).map((o) => `${o.module}:${o.action}`),
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

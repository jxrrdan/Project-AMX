import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({ compare: jest.fn() }));
jest.mock('otplib', () => ({ authenticator: { check: jest.fn() } }));

const DEALER = { id: 'dealer-1', subdomain: 'bmwnorthampton' };

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    dealerId: DEALER.id,
    email: 'principal@bmwnorthampton.ams-app.co.uk',
    firstName: 'Pat',
    lastName: 'Principal',
    passwordHash: 'hashed',
    active: true,
    mfaEnabled: false,
    mfaSecret: null,
    roles: [
      {
        role: {
          name: 'Dealer Principal',
          permissions: [{ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW }],
        },
      },
    ],
    moduleOverrides: [],
    ...overrides,
  };
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    dealer: { findUnique: jest.fn().mockResolvedValue(DEALER) },
    user: { findUnique: jest.fn().mockResolvedValue(makeUser()), update: jest.fn().mockResolvedValue({}) },
    loginAudit: { create: jest.fn() },
    userSession: { create: jest.fn().mockResolvedValue({}), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn((ops) => Promise.all(ops)),
    ...overrides,
  };
}

function makeService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = makePrisma(prismaOverrides);
  const jwt = { sign: jest.fn().mockReturnValue('signed-jwt') };
  const config = { get: jest.fn((_key: string, fallback?: unknown) => fallback ?? 'secret') };
  const service = new AuthService(prisma as never, jwt as never, config as never);
  return { service, prisma, jwt, config };
}

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('rejects an unknown dealer subdomain', async () => {
      const { service, prisma } = makeService({ dealer: { findUnique: jest.fn().mockResolvedValue(null) } });
      await expect(service.login({ subdomain: 'nope', email: 'x@x.com', password: 'x' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a wrong password and records a failed login audit', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const { service, prisma } = makeService();

      await expect(
        service.login({ subdomain: 'bmwnorthampton', email: 'principal@bmwnorthampton.ams-app.co.uk', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.loginAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ success: false }) }),
      );
    });

    it('rejects an inactive user even with the correct password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const { service } = makeService({
        user: { findUnique: jest.fn().mockResolvedValue(makeUser({ active: false })) },
      });
      await expect(
        service.login({ subdomain: 'bmwnorthampton', email: 'principal@bmwnorthampton.ams-app.co.uk', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('demands an MFA code when the user has MFA enabled', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const { service } = makeService({
        user: { findUnique: jest.fn().mockResolvedValue(makeUser({ mfaEnabled: true, mfaSecret: 'SECRET' })) },
      });
      await expect(
        service.login({ subdomain: 'bmwnorthampton', email: 'principal@bmwnorthampton.ams-app.co.uk', password: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects an incorrect MFA code and records a failed login audit', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (authenticator.check as jest.Mock).mockReturnValue(false);
      const { service, prisma } = makeService({
        user: { findUnique: jest.fn().mockResolvedValue(makeUser({ mfaEnabled: true, mfaSecret: 'SECRET' })) },
      });

      await expect(
        service.login({
          subdomain: 'bmwnorthampton',
          email: 'principal@bmwnorthampton.ams-app.co.uk',
          password: 'x',
          totpCode: '000000',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.loginAudit.create).toHaveBeenCalled();
    });

    it('issues tokens and merges role permissions with module override grants', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const { service } = makeService({
        user: {
          findUnique: jest.fn().mockResolvedValue(
            makeUser({
              moduleOverrides: [{ module: ModuleKey.PARTS, action: PermissionAction.EDIT, allowed: true }],
            }),
          ),
          update: jest.fn().mockResolvedValue({}),
        },
      });

      const result = await service.login({
        subdomain: 'bmwnorthampton',
        email: 'principal@bmwnorthampton.ams-app.co.uk',
        password: 'x',
      });

      expect(result.accessToken).toBe('signed-jwt');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.user.permissions).toEqual(
        expect.arrayContaining([
          { module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW },
          { module: ModuleKey.PARTS, action: PermissionAction.EDIT },
        ]),
      );
    });

    it('strips a role-granted permission that has an explicit override deny', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const { service } = makeService({
        user: {
          findUnique: jest.fn().mockResolvedValue(
            makeUser({
              moduleOverrides: [{ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW, allowed: false }],
            }),
          ),
          update: jest.fn().mockResolvedValue({}),
        },
      });

      const result = await service.login({
        subdomain: 'bmwnorthampton',
        email: 'principal@bmwnorthampton.ams-app.co.uk',
        password: 'x',
      });

      expect(result.user.permissions).not.toContainEqual({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW });
    });
  });

  describe('refresh', () => {
    it('rejects an expired session', async () => {
      const { service } = makeService({
        userSession: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'session-1',
            revokedAt: null,
            expiresAt: new Date(Date.now() - 1000),
            user: makeUser(),
          }),
          update: jest.fn(),
        },
      });
      await expect(service.refresh('some-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a revoked session', async () => {
      const { service } = makeService({
        userSession: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'session-1',
            revokedAt: new Date(),
            expiresAt: new Date(Date.now() + 100000),
            user: makeUser(),
          }),
          update: jest.fn(),
        },
      });
      await expect(service.refresh('some-token')).rejects.toThrow(UnauthorizedException);
    });

    it('revokes the old session and issues a new token pair for a valid session', async () => {
      const update = jest.fn();
      const { service, prisma } = makeService({
        userSession: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'session-1',
            revokedAt: null,
            expiresAt: new Date(Date.now() + 100000),
            user: makeUser(),
          }),
          update,
          create: jest.fn().mockResolvedValue({}),
        },
      });

      const result = await service.refresh('some-token');

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'session-1' }, data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
      );
      expect(prisma.userSession.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('signed-jwt');
    });
  });

  describe('logout', () => {
    it('revokes every session matching the refresh token', async () => {
      const { service, prisma } = makeService();
      await service.logout('some-token');
      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { refreshToken: 'some-token' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});

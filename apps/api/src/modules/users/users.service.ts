import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey } from '@project-amx/shared';
import * as bcrypt from 'bcrypt';
import { addHours } from 'date-fns';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AcceptInvitationDto, InviteUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  findAll(dealerId: string) {
    return this.prisma.user.findMany({
      where: { dealerId },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Invitation link expires after 48 hours per Feature Spec §7.3. */
  async invite(dealerId: string, dto: InviteUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { dealerId_email: { dealerId, email: dto.email } },
    });
    if (existing) {
      throw new BadRequestException('A user with this email already exists for this dealer');
    }

    const invitation = await this.prisma.invitation.create({
      data: {
        dealerId,
        email: dto.email,
        roleIds: dto.roleIds,
        token: randomUUID(),
        expiresAt: addHours(new Date(), 48),
      },
    });

    await this.email.send({
      to: dto.email,
      subject: 'You have been invited to AMS',
      html: `<p>Hi ${dto.firstName},</p><p>You've been invited to join your dealer's AMS workspace. Use invitation code <b>${invitation.token}</b> to set your password (expires in 48 hours).</p>`,
    });

    return invitation;
  }

  async acceptInvitation(dto: AcceptInvitationDto) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token: dto.token } });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const [firstName, ...rest] = invitation.email.split('@');

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          dealerId: invitation.dealerId,
          email: invitation.email,
          firstName,
          lastName: rest.join('@') || 'User',
          passwordHash,
          roles: { create: invitation.roleIds.map((roleId) => ({ roleId })) },
        },
      });
      await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
      return created;
    });

    return user;
  }

  async update(dealerId: string, userId: string, dto: UpdateUserDto, actingUserId?: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, dealerId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { roleIds, moduleOverrides } = dto;

    await this.prisma.$transaction(async (tx) => {
      if (roleIds) {
        await tx.userRole.deleteMany({ where: { userId } });
        await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })) });
      }
      if (moduleOverrides) {
        await tx.userModuleOverride.deleteMany({ where: { userId } });
        await tx.userModuleOverride.createMany({
          data: moduleOverrides.map((o) => ({ userId, module: o.module, action: o.action, allowed: o.allowed })),
        });
      }
      if (dto.active !== undefined) {
        await tx.user.update({ where: { id: userId }, data: { active: dto.active } });
        if (!dto.active) {
          await tx.userSession.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
        }
      }
    });

    await this.audit.record({
      dealerId,
      userId: actingUserId,
      module: ModuleKey.ADMIN,
      action: 'user.update',
      recordType: 'User',
      recordId: userId,
      after: dto,
    });

    return this.prisma.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
  }

  /** Dealer principal terminates any active session immediately (Feature Spec §7.4). */
  async forceLogout(dealerId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, dealerId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.userSession.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    return { success: true };
  }

  bulkImport(dealerId: string, rows: { email: string; firstName: string; lastName: string; roleIds: string[] }[]) {
    return Promise.all(rows.map((row) => this.invite(dealerId, row)));
  }
}

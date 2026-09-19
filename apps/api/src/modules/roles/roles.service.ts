import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

/** Custom roles per Feature Spec §7.2 — a dealer principal builds one from the granular permission matrix. */
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(dealerId: string) {
    return this.prisma.role.findMany({
      where: { dealerId },
      include: { permissions: true },
      orderBy: { name: 'asc' },
    });
  }

  /** "Cannot grant what you don't have" — see UsersService.update for the full rationale. */
  private assertGrantable(
    permissions: { module: ModuleKey; action: PermissionAction }[],
    actingUserPermissions: { module: ModuleKey; action: PermissionAction }[],
  ) {
    const heldByActor = new Set(actingUserPermissions.map((p) => `${p.module}:${p.action}`));
    for (const permission of permissions) {
      if (!heldByActor.has(`${permission.module}:${permission.action}`)) {
        throw new ForbiddenException(
          `Cannot grant ${permission.module}:${permission.action} to a role — you do not hold this permission yourself`,
        );
      }
    }
  }

  async create(
    dealerId: string,
    dto: CreateRoleDto,
    actingUserPermissions: { module: ModuleKey; action: PermissionAction }[] = [],
  ) {
    const existing = await this.prisma.role.findUnique({ where: { dealerId_name: { dealerId, name: dto.name } } });
    if (existing) {
      throw new BadRequestException('A role with this name already exists');
    }
    this.assertGrantable(dto.permissions, actingUserPermissions);

    return this.prisma.role.create({
      data: {
        dealerId,
        name: dto.name,
        isCustom: true,
        permissions: { create: dto.permissions },
      },
      include: { permissions: true },
    });
  }

  async update(
    dealerId: string,
    roleId: string,
    dto: UpdateRoleDto,
    actingUserPermissions: { module: ModuleKey; action: PermissionAction }[] = [],
  ) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, dealerId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    this.assertGrantable(dto.permissions, actingUserPermissions);

    return this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      return tx.role.update({
        where: { id: roleId },
        data: { name: dto.name, permissions: { create: dto.permissions } },
        include: { permissions: true },
      });
    });
  }

  async remove(dealerId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, dealerId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (!role.isCustom) {
      throw new BadRequestException('System roles cannot be deleted');
    }
    await this.prisma.role.delete({ where: { id: roleId } });
    return { success: true };
  }
}

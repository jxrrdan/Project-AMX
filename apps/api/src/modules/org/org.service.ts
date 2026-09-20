import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AssignDealerFranchiseDto, CreateFranchiseDto, CreateGroupDto } from './dto/org.dto';

/**
 * Group → Franchise → Dealer hierarchy (e.g. a dealer group owning outlets across BMW/MINI
 * franchises). There's no separate cross-dealer admin identity in this app (see
 * TenancyScopeService's doc comment) — joining a franchise/group is self-service: any
 * ModuleKey.ADMIN:EDIT user assigns their OWN dealer, never another one.
 */
@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  listGroups() {
    return this.prisma.group.findMany({ orderBy: { name: 'asc' } });
  }

  listFranchises() {
    return this.prisma.franchise.findMany({ orderBy: { name: 'asc' }, include: { group: true } });
  }

  createGroup(dto: CreateGroupDto) {
    return this.prisma.group.create({ data: { name: dto.name } });
  }

  async createFranchise(dto: CreateFranchiseDto) {
    if (dto.groupId) {
      const group = await this.prisma.group.findUnique({ where: { id: dto.groupId } });
      if (!group) {
        throw new BadRequestException('Unknown group');
      }
    }
    return this.prisma.franchise.create({ data: { name: dto.name, brandCode: dto.brandCode, groupId: dto.groupId } });
  }

  async assignDealerFranchise(dealerId: string, dto: AssignDealerFranchiseDto) {
    if (dto.franchiseId) {
      const franchise = await this.prisma.franchise.findUnique({ where: { id: dto.franchiseId } });
      if (!franchise) {
        throw new NotFoundException('Franchise not found');
      }
    }
    return this.prisma.dealer.update({ where: { id: dealerId }, data: { franchiseId: dto.franchiseId ?? null } });
  }
}

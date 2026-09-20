import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AssignDealerFranchiseDto, CreateFranchiseDto, CreateGroupDto } from './dto/org.dto';

/**
 * Group → Franchise → Dealer hierarchy (e.g. a dealer group owning outlets across BMW/MINI
 * franchises). There's no separate cross-dealer admin identity in this app (see
 * TenancyScopeService's doc comment) — joining a franchise/group is self-service: any
 * ModuleKey.ADMIN:EDIT user assigns their OWN dealer, never another one.
 *
 * Attaching to an EXISTING franchise/group is gated by an unguessable joinCode (never the row's
 * raw id) — a member shares their franchise/group's own joinCode with a sibling dealer out of
 * band, the same way a webhook token is shared, rather than the caller picking any id off a list.
 * Without this, any ADMIN:EDIT user anywhere could attach their dealer to any franchise/group
 * whose id they'd seen or guessed, inheriting read/write access to that org's shared document
 * templates and Action Triggers — a genuine cross-tenant escalation this design specifically
 * closes off.
 */
@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the CALLER's own franchise/group only — never a directory of every org in the system. */
  async myOrg(dealerId: string) {
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
      include: { franchise: { include: { group: true } } },
    });
    const franchise = dealer?.franchise ?? null;
    return {
      franchise: franchise
        ? { id: franchise.id, name: franchise.name, brandCode: franchise.brandCode, joinCode: franchise.joinCode }
        : null,
      group: franchise?.group
        ? { id: franchise.group.id, name: franchise.group.name, joinCode: franchise.group.joinCode }
        : null,
    };
  }

  createGroup(dto: CreateGroupDto) {
    return this.prisma.group.create({ data: { name: dto.name } });
  }

  async createFranchise(dto: CreateFranchiseDto) {
    let groupId: string | undefined;
    if (dto.groupJoinCode) {
      const group = await this.prisma.group.findUnique({ where: { joinCode: dto.groupJoinCode } });
      if (!group) {
        throw new BadRequestException('Invalid group join code');
      }
      groupId = group.id;
    }
    return this.prisma.franchise.create({ data: { name: dto.name, brandCode: dto.brandCode, groupId } });
  }

  async assignDealerFranchise(dealerId: string, dto: AssignDealerFranchiseDto) {
    if (!dto.franchiseJoinCode) {
      return this.prisma.dealer.update({ where: { id: dealerId }, data: { franchiseId: null } });
    }
    const franchise = await this.prisma.franchise.findUnique({ where: { joinCode: dto.franchiseJoinCode } });
    if (!franchise) {
      throw new BadRequestException('Invalid franchise join code');
    }
    return this.prisma.dealer.update({ where: { id: dealerId }, data: { franchiseId: franchise.id } });
  }
}

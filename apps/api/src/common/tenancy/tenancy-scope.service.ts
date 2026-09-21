import { Injectable } from '@nestjs/common';
import { ConfigScope } from '@project-amx/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface ScopeContext {
  dealerId: string;
  franchiseId: string | null;
  groupId: string | null;
}

export type ScopeWhereClause =
  | { scope: ConfigScope.DEALER; dealerId: string }
  | { scope: ConfigScope.FRANCHISE; franchiseId: string }
  | { scope: ConfigScope.GROUP; groupId: string };

/**
 * Resolves a dealer's place in the Group → Franchise → Dealer hierarchy, and answers "which
 * shared-config rows can this dealer see/manage" — shared by DocumentTemplatesService and
 * ActionTriggersService, the two things configurable at group/franchise/dealer level.
 *
 * Trust model (v1): there is no separate "group admin" or "franchise admin" identity in this
 * app — every user belongs to exactly one dealer (see User.dealerId). So franchise/group-scoped
 * config is collaboratively owned: any ModuleKey.ADMIN:EDIT user (Dealer Principal/GM) at ANY
 * dealer within that franchise/group can create or edit its shared defaults. That's a deliberate
 * simplification, not an oversight — a real cross-dealer admin role is a bigger identity change
 * than this pass covers.
 */
@Injectable()
export class TenancyScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(dealerId: string): Promise<ScopeContext> {
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
      select: { franchiseId: true, franchise: { select: { groupId: true } } },
    });
    return {
      dealerId,
      franchiseId: dealer?.franchiseId ?? null,
      groupId: dealer?.franchise?.groupId ?? null,
    };
  }

  /** Most-specific-first: DEALER, then FRANCHISE (if assigned), then GROUP (if assigned). */
  scopeWhereClauses(ctx: ScopeContext): ScopeWhereClause[] {
    const clauses: ScopeWhereClause[] = [{ scope: ConfigScope.DEALER, dealerId: ctx.dealerId }];
    if (ctx.franchiseId) clauses.push({ scope: ConfigScope.FRANCHISE, franchiseId: ctx.franchiseId });
    if (ctx.groupId) clauses.push({ scope: ConfigScope.GROUP, groupId: ctx.groupId });
    return clauses;
  }

  /** True if a row at `scope`/`ownerId` (its franchiseId/groupId/dealerId, whichever applies) is
   * visible to — and, per the trust model above, manageable by — this dealer. `scope` is typed as
   * `string` (not the shared `ConfigScope` enum) purely so Prisma's generated `$Enums.ConfigScope`
   * — a structurally-identical but nominally distinct type — can be passed straight through
   * without a cast at every call site. */
  async canAccess(
    dealerId: string,
    row: { scope: string; dealerId: string | null; franchiseId: string | null; groupId: string | null },
  ): Promise<boolean> {
    if (row.scope === ConfigScope.DEALER) return row.dealerId === dealerId;
    const ctx = await this.resolve(dealerId);
    if (row.scope === ConfigScope.FRANCHISE) return !!row.franchiseId && row.franchiseId === ctx.franchiseId;
    if (row.scope === ConfigScope.GROUP) return !!row.groupId && row.groupId === ctx.groupId;
    return false;
  }
}

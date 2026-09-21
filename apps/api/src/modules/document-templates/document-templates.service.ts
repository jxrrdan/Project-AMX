import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigScope, DocumentTemplateType } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenancyScopeService } from '../../common/tenancy/tenancy-scope.service';
import { CreateDocumentTemplateDto, UpdateDocumentTemplateDto } from './dto/document-template.dto';

/**
 * CRUD for dealer/franchise/group-authored document templates (Settings > Document templates) —
 * a business user writes HTML/CSS with `{{variable}}` placeholders (see
 * DOCUMENT_TEMPLATE_VARIABLES in @project-amx/shared) and an optional `{{dealerLogoUrl}}` image,
 * and the result replaces the built-in default the next time that document type is generated
 * (see UsedCarsService.createDealSheet for the deal-sheet example).
 *
 * Configurable at any of the three tenancy levels — a franchise (e.g. "BMW") or a whole dealer
 * group can set a shared default that every outlet inherits unless it sets its own; resolution
 * always prefers the most specific (DEALER, then FRANCHISE, then GROUP) — see
 * TenancyScopeService for the resolution/trust-model details.
 *
 * Trust note: rendering compiles this HTML as a full Handlebars template (PdfService), same as
 * every other document in this app — but unlike the CRM SMS free-text case (fixed in the security
 * review: any CRM:CREATE user could submit that body), only a ModuleKey.ADMIN:EDIT user (in
 * practice Dealer Principal / General Manager) can ever author a template here, matching the
 * trust level already given to that role elsewhere (Users & Roles).
 */
@Injectable()
export class DocumentTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyScopeService,
  ) {}

  async list(dealerId: string, type?: DocumentTemplateType) {
    const ctx = await this.tenancy.resolve(dealerId);
    const clauses = this.tenancy.scopeWhereClauses(ctx);
    return this.prisma.documentTemplate.findMany({
      where: { OR: clauses, type: type || undefined },
      orderBy: [{ type: 'asc' }, { scope: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async get(dealerId: string, id: string) {
    const template = await this.prisma.documentTemplate.findUnique({ where: { id } });
    if (!template || !(await this.tenancy.canAccess(dealerId, template))) {
      throw new NotFoundException('Document template not found');
    }
    return template;
  }

  async create(dealerId: string, dto: CreateDocumentTemplateDto) {
    const scope = dto.scope ?? ConfigScope.DEALER;
    const ownerId = await this.resolveOwnerId(dealerId, scope);
    return this.prisma.documentTemplate.create({
      data: {
        scope,
        type: dto.type,
        name: dto.name,
        bodyHtml: dto.bodyHtml,
        dealerId: scope === ConfigScope.DEALER ? ownerId : undefined,
        franchiseId: scope === ConfigScope.FRANCHISE ? ownerId : undefined,
        groupId: scope === ConfigScope.GROUP ? ownerId : undefined,
      },
    });
  }

  async update(dealerId: string, id: string, dto: UpdateDocumentTemplateDto) {
    await this.get(dealerId, id);
    return this.prisma.documentTemplate.update({ where: { id }, data: dto });
  }

  async delete(dealerId: string, id: string) {
    await this.get(dealerId, id);
    await this.prisma.documentTemplate.delete({ where: { id } });
    return { success: true };
  }

  /** Exactly one template per (owner, type) may be the default — used automatically when that document is generated. */
  async setDefault(dealerId: string, id: string) {
    const template = await this.get(dealerId, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.documentTemplate.updateMany({
        where: {
          type: template.type,
          isDefault: true,
          scope: template.scope,
          dealerId: template.dealerId ?? undefined,
          franchiseId: template.franchiseId ?? undefined,
          groupId: template.groupId ?? undefined,
        },
        data: { isDefault: false },
      });
      return tx.documentTemplate.update({ where: { id }, data: { isDefault: true } });
    });
  }

  /** Used by document-generating services: the most specific default template body across
   * dealer/franchise/group, or the built-in fallback if nobody has set one up. */
  async getDefaultBody(dealerId: string, type: DocumentTemplateType, fallback: string): Promise<string> {
    const ctx = await this.tenancy.resolve(dealerId);
    for (const clause of this.tenancy.scopeWhereClauses(ctx)) {
      const template = await this.prisma.documentTemplate.findFirst({ where: { ...clause, type, isDefault: true } });
      if (template) return template.bodyHtml;
    }
    return fallback;
  }

  /** Resolves which franchise/group id a franchise/group-scoped template should be attached to —
   * always the CALLING dealer's own franchise/group (see TenancyScopeService's trust model), never
   * an arbitrary id supplied by the client, so a dealer can never write config into someone else's
   * franchise/group. */
  private async resolveOwnerId(dealerId: string, scope: ConfigScope): Promise<string> {
    if (scope === ConfigScope.DEALER) return dealerId;
    const ctx = await this.tenancy.resolve(dealerId);
    if (scope === ConfigScope.FRANCHISE) {
      if (!ctx.franchiseId) throw new BadRequestException('Your outlet is not assigned to a franchise yet');
      return ctx.franchiseId;
    }
    if (!ctx.groupId) throw new BadRequestException("Your outlet's franchise is not assigned to a group yet");
    return ctx.groupId;
  }
}

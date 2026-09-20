import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentTemplateType } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateDocumentTemplateDto, UpdateDocumentTemplateDto } from './dto/document-template.dto';

/**
 * CRUD for dealer-authored document templates (Settings > Document templates) — a business user
 * writes HTML/CSS with `{{variable}}` placeholders (see DOCUMENT_TEMPLATE_VARIABLES in
 * @project-amx/shared) and an optional `{{dealerLogoUrl}}` image, and the result replaces the
 * built-in default the next time that document type is generated (see DealSheetTemplateService
 * usage in UsedCarsService for the one wired-up example).
 *
 * Trust note: rendering compiles this HTML as a full Handlebars template (PdfService), same as
 * every other document in this app — but unlike the CRM SMS free-text case (fixed in the security
 * review: any CRM:CREATE user could submit that body), only a ModuleKey.ADMIN:EDIT user (in
 * practice Dealer Principal / General Manager) can ever author a template here, matching the
 * trust level already given to that role elsewhere (Users & Roles).
 */
@Injectable()
export class DocumentTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list(dealerId: string, type?: DocumentTemplateType) {
    return this.prisma.documentTemplate.findMany({
      where: { dealerId, type: type || undefined },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async get(dealerId: string, id: string) {
    const template = await this.prisma.documentTemplate.findFirst({ where: { id, dealerId } });
    if (!template) {
      throw new NotFoundException('Document template not found');
    }
    return template;
  }

  create(dealerId: string, dto: CreateDocumentTemplateDto) {
    return this.prisma.documentTemplate.create({ data: { dealerId, ...dto } });
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

  /** Exactly one template per (dealer, type) may be the default — used automatically when that document is generated. */
  async setDefault(dealerId: string, id: string) {
    const template = await this.get(dealerId, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.documentTemplate.updateMany({
        where: { dealerId, type: template.type, isDefault: true },
        data: { isDefault: false },
      });
      return tx.documentTemplate.update({ where: { id }, data: { isDefault: true } });
    });
  }

  /** Used by document-generating services: the dealer's default template body, or the built-in fallback if they haven't set one up. */
  async getDefaultBody(dealerId: string, type: DocumentTemplateType, fallback: string): Promise<string> {
    const template = await this.prisma.documentTemplate.findFirst({ where: { dealerId, type, isDefault: true } });
    return template?.bodyHtml ?? fallback;
  }
}

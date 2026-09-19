import { Injectable, NotFoundException } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SmsService } from '../../common/sms/sms.service';
import { CreateEmailTemplateDto, SendEmailDto, SendSmsDto } from './dto/template.dto';

/** Module 8.5-8.7 — templated email/SMS communications with variable resolution. */
@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  listTemplates(dealerId: string) {
    return this.prisma.emailTemplate.findMany({ where: { dealerId } });
  }

  createTemplate(dealerId: string, dto: CreateEmailTemplateDto) {
    return this.prisma.emailTemplate.create({ data: { dealerId, ...dto } });
  }

  /** Preview before send — shows resolved variables (§8.6). */
  async previewTemplate(dealerId: string, templateId: string, contactId: string) {
    const [template, contact] = await Promise.all([
      this.prisma.emailTemplate.findFirst({ where: { id: templateId, dealerId } }),
      this.prisma.contact.findFirst({ where: { id: contactId, dealerId } }),
    ]);
    if (!template || !contact) {
      throw new NotFoundException('Template or contact not found');
    }
    return {
      subject: this.renderTrustedTemplate(template.subject, contact),
      bodyHtml: this.renderTrustedTemplate(template.bodyHtml, contact),
    };
  }

  async sendEmail(dealerId: string, dto: SendEmailDto) {
    const [template, contact] = await Promise.all([
      this.prisma.emailTemplate.findFirst({ where: { id: dto.templateId, dealerId } }),
      this.prisma.contact.findFirst({ where: { id: dto.contactId, dealerId } }),
    ]);
    if (!template || !contact || !contact.email) {
      throw new NotFoundException('Template, contact, or contact email not found');
    }

    const subject = this.renderTrustedTemplate(template.subject, contact);
    const bodyHtml = this.renderTrustedTemplate(template.bodyHtml, contact);
    await this.email.send({ to: contact.email, subject, html: bodyHtml });

    return this.prisma.emailMessage.create({
      data: { contactId: contact.id, templateId: template.id, subject, bodyHtml, status: 'SENT', sentAt: new Date() },
    });
  }

  async sendSms(dealerId: string, dto: SendSmsDto) {
    const contact = await this.prisma.contact.findFirst({ where: { id: dto.contactId, dealerId } });
    if (!contact || !contact.phone) {
      throw new NotFoundException('Contact or phone number not found');
    }
    const body = this.substitutePlaceholders(dto.body, contact);
    await this.sms.send(contact.phone, body);
    return this.prisma.smsMessage.create({ data: { contactId: contact.id, body, status: 'SENT', sentAt: new Date() } });
  }

  /**
   * Only compiles dealer-authored, stored template content (created via createTemplate, a
   * separate CRM:CREATE-gated step) — never raw end-user input. Handlebars.compile() has no
   * sandboxing against constructor/prototype-walking payloads, so it must never see a string an
   * ordinary user typed into a form on this request.
   */
  private renderTrustedTemplate(source: string, contact: { firstName: string; lastName: string }): string {
    return Handlebars.compile(source)({ first_name: contact.firstName, last_name: contact.lastName });
  }

  /**
   * A free-form SMS body is typed fresh on every send (no prior "author a template" gate), so it
   * is never safe to compile as a Handlebars template — that would let a plain CRM:CREATE user
   * attempt server-side template injection. Only a small, fixed set of placeholders is resolved.
   */
  private substitutePlaceholders(source: string, contact: { firstName: string; lastName: string }): string {
    return source
      .replace(/\{\{\s*first_name\s*\}\}/g, contact.firstName)
      .replace(/\{\{\s*last_name\s*\}\}/g, contact.lastName);
  }
}

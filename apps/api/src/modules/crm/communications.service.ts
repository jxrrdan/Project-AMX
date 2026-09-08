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
  async previewTemplate(templateId: string, contactId: string) {
    const [template, contact] = await Promise.all([
      this.prisma.emailTemplate.findUnique({ where: { id: templateId } }),
      this.prisma.contact.findUnique({ where: { id: contactId } }),
    ]);
    if (!template || !contact) {
      throw new NotFoundException('Template or contact not found');
    }
    return { subject: this.render(template.subject, contact), bodyHtml: this.render(template.bodyHtml, contact) };
  }

  async sendEmail(dto: SendEmailDto) {
    const [template, contact] = await Promise.all([
      this.prisma.emailTemplate.findUnique({ where: { id: dto.templateId } }),
      this.prisma.contact.findUnique({ where: { id: dto.contactId } }),
    ]);
    if (!template || !contact || !contact.email) {
      throw new NotFoundException('Template, contact, or contact email not found');
    }

    const subject = this.render(template.subject, contact);
    const bodyHtml = this.render(template.bodyHtml, contact);
    await this.email.send({ to: contact.email, subject, html: bodyHtml });

    return this.prisma.emailMessage.create({
      data: { contactId: contact.id, templateId: template.id, subject, bodyHtml, status: 'SENT', sentAt: new Date() },
    });
  }

  async sendSms(dto: SendSmsDto) {
    const contact = await this.prisma.contact.findUnique({ where: { id: dto.contactId } });
    if (!contact || !contact.phone) {
      throw new NotFoundException('Contact or phone number not found');
    }
    const body = this.render(dto.body, contact);
    await this.sms.send(contact.phone, body);
    return this.prisma.smsMessage.create({ data: { contactId: contact.id, body, status: 'SENT', sentAt: new Date() } });
  }

  private render(source: string, contact: { firstName: string; lastName: string }): string {
    return Handlebars.compile(source)({ first_name: contact.firstName, last_name: contact.lastName });
  }
}

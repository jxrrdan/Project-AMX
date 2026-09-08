import { TemplateCategory } from '@project-amx/shared';
import { IsEnum, IsString } from 'class-validator';

export class CreateEmailTemplateDto {
  @IsString()
  name!: string;

  @IsEnum(TemplateCategory)
  category!: TemplateCategory;

  @IsString()
  subject!: string;

  @IsString()
  bodyHtml!: string;
}

export class SendEmailDto {
  @IsString()
  contactId!: string;

  @IsString()
  templateId!: string;
}

export class SendSmsDto {
  @IsString()
  contactId!: string;

  @IsString()
  body!: string;
}

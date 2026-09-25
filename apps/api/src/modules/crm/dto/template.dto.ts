import { CallDirection, CallOutcome, TemplateCategory } from '@project-amx/shared';
import { IsEnum, IsOptional, IsString } from 'class-validator';

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

/** No real telephony provider is wired in — this records the fact and outcome of a call a
 * member of staff made or took, the click-to-call/call-logging gap against Keyloop/Pinewood's
 * telephony integrations. */
export class LogCallDto {
  @IsEnum(CallDirection)
  direction!: CallDirection;

  @IsEnum(CallOutcome)
  outcome!: CallOutcome;

  @IsOptional()
  @IsString()
  notes?: string;
}

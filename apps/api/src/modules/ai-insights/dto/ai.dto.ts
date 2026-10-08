import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class NlQueryDto {
  @IsString()
  question!: string;
}

export class EmailDraftDto {
  @IsString()
  contactId!: string;

  @IsString()
  templateCategory!: string;

  @IsOptional()
  @IsString()
  tone?: string;
}

export class ChatMessageDto {
  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsString()
  message!: string;
}

export class ChatbotMessageDto {
  @IsOptional()
  @IsString()
  conversationId?: string;

  /** Capped: every character is sent to the (billed) AI provider. */
  @IsString()
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;

  @IsOptional()
  @IsString()
  captchaAnswer?: string;
}

import { IsOptional, IsString } from 'class-validator';

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

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerName?: string;
}

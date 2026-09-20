import { DocumentTemplateType } from '@project-amx/shared';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateDocumentTemplateDto {
  @IsEnum(DocumentTemplateType)
  type!: DocumentTemplateType;

  @IsString()
  name!: string;

  @IsString()
  bodyHtml!: string;
}

export class UpdateDocumentTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;
}

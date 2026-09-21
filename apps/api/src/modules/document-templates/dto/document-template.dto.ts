import { ConfigScope, DocumentTemplateType } from '@project-amx/shared';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateDocumentTemplateDto {
  @IsEnum(DocumentTemplateType)
  type!: DocumentTemplateType;

  @IsString()
  name!: string;

  @IsString()
  bodyHtml!: string;

  /** Defaults to DEALER. FRANCHISE/GROUP always resolve to the calling dealer's OWN franchise/group
   * — see DocumentTemplatesService.resolveOwnerId — never a client-supplied id. */
  @IsOptional()
  @IsEnum(ConfigScope)
  scope?: ConfigScope;
}

export class UpdateDocumentTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;
}

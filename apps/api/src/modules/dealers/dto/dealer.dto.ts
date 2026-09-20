import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ModuleKey } from '@project-amx/shared';

export class UpdateDealerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  franchiseCode?: string;

  @IsOptional()
  @IsString()
  risDealerId?: string;

  @IsOptional()
  @IsString()
  awpWebhookUrl?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  primaryColour?: string;

  @IsOptional()
  @IsString()
  secondaryColour?: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsOptional()
  @IsString()
  invoiceFooterNote?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

export class SetModuleLicenseDto {
  @IsEnum(ModuleKey)
  module!: ModuleKey;

  @IsBoolean()
  enabled!: boolean;
}

export class UploadLogoDto {
  /** A `data:image/...;base64,...` URI — kept as a plain JSON field rather than multipart/form-data
   * since no other endpoint in this app needs a file-upload pipeline yet (see StorageService). */
  @IsString()
  dataUrl!: string;
}

export class UpdateDocumentSequenceDto {
  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  nextNumber?: number;
}

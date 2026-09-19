import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
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

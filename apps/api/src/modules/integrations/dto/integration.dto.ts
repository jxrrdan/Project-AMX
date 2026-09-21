import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CustomFieldDataType, IntegrationStatus, IntegrationTargetEntity, IntegrationType } from '@project-amx/shared';

export class CreateConnectorDto {
  @IsString()
  name!: string;

  @IsEnum(IntegrationType)
  type!: IntegrationType;

  @IsEnum(IntegrationTargetEntity)
  targetEntity!: IntegrationTargetEntity;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  matchField?: string;
}

export class UpdateConnectorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(IntegrationStatus)
  status?: IntegrationStatus;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  matchField?: string;
}

export class FieldMappingDto {
  @IsString()
  sourcePath!: string;

  @IsString()
  targetField!: string;

  @IsOptional()
  @IsBoolean()
  isCustomField?: boolean;

  @IsOptional()
  @IsString()
  transform?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class SetMappingsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  mappings!: FieldMappingDto[];
}

export class CreateCustomFieldDto {
  @IsEnum(IntegrationTargetEntity)
  entity!: IntegrationTargetEntity;

  @IsString()
  key!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsEnum(CustomFieldDataType)
  dataType?: CustomFieldDataType;
}

export class TestPayloadDto {
  @IsObject()
  payload!: Record<string, unknown>;
}

export class ScreenFieldDto {
  @IsString()
  field!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsBoolean()
  isCustomField?: boolean;
}

export class SaveScreenDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScreenFieldDto)
  fields!: ScreenFieldDto[];
}

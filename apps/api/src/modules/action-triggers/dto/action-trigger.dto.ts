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
import { ActionTriggerPoint, ConfigScope, IntegrationTargetEntity } from '@project-amx/shared';

export class CreateActionTriggerDto {
  @IsString()
  name!: string;

  @IsEnum(ActionTriggerPoint)
  triggerPoint!: ActionTriggerPoint;

  @IsEnum(IntegrationTargetEntity)
  targetEntity!: IntegrationTargetEntity;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  /** Defaults to DEALER. FRANCHISE/GROUP always resolve to the calling dealer's OWN
   * franchise/group — never a client-supplied id (same rule as document templates). */
  @IsOptional()
  @IsEnum(ConfigScope)
  scope?: ConfigScope;
}

export class UpdateActionTriggerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class ActionTriggerMappingDto {
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

export class SetActionTriggerMappingsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ActionTriggerMappingDto)
  mappings!: ActionTriggerMappingDto[];
}

export class RunActionTriggerDto {
  @IsString()
  value!: string;
}

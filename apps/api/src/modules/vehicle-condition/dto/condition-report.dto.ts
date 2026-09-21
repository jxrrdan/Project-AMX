import { ConditionCheckStage, DamageSeverity } from '@project-amx/shared';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class DamageMarkerDto {
  @IsString()
  location!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsEnum(DamageSeverity)
  severity?: DamageSeverity;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class CreateConditionReportDto {
  @IsEnum(ConditionCheckStage)
  stage!: ConditionCheckStage;

  @IsOptional()
  @IsInt()
  @Min(0)
  mileage?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DamageMarkerDto)
  damageMarkers?: DamageMarkerDto[];
}

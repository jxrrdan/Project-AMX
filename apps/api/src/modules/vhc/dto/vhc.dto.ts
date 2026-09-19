import { VhcRating } from '@project-amx/shared';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateVhcInspectionDto {
  @IsString()
  jobCardId!: string;

  @IsString()
  vehicleReg!: string;

  @IsOptional()
  @IsInt()
  mileage?: number;
}

export class AddVhcItemDto {
  @IsString()
  category!: string;

  @IsString()
  label!: string;

  @IsEnum(VhcRating)
  rating!: VhcRating;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedLabourMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedPartsCost?: number;
}

export class RespondToItemDto {
  @IsBoolean()
  approved!: boolean;
}

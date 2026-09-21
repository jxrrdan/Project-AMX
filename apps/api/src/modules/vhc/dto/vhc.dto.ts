import { VhcItemResponseStatus, VhcRating } from '@project-amx/shared';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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
  @IsEnum(VhcItemResponseStatus)
  response!: VhcItemResponseStatus;
}

/** Technician sign-off — marks the inspection as recorded/videoed and ready for the assigned
 * service advisor to review (§ VHC advisor workflow). */
export class RecordInspectionDto {
  @IsOptional()
  @IsString()
  videoUrl?: string;
}

export class LogPhoneContactDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

/** Links a VHC item to a real stocked part so the auto-quote (§ VHC auto-quote) uses its actual
 * costPrice instead of a typed-in estimate. */
export class AddVhcItemPartDto {
  @IsString()
  partId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

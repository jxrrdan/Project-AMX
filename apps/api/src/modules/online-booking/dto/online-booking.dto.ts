import { OnlineBookingStatus } from '@project-amx/shared';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateOnlineBookingDto {
  @IsString()
  customerName!: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsString()
  vehicleReg!: string;

  @IsString()
  serviceType!: string;

  @IsOptional()
  @IsDateString()
  preferredDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;

  @IsOptional()
  @IsString()
  captchaAnswer?: string;
}

export class UpdateOnlineBookingDto {
  @IsEnum(OnlineBookingStatus)
  status!: OnlineBookingStatus;
}

import { IsDateString, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateServiceBookingDto {
  @IsString()
  @MaxLength(120)
  customerName!: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @IsString()
  @MaxLength(15)
  vehicleReg!: string;

  @IsString()
  @MaxLength(100)
  serviceType!: string;

  @IsDateString()
  requestedSlot!: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;

  @IsOptional()
  @IsString()
  captchaAnswer?: string;
}

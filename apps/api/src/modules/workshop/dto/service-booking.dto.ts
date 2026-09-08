import { IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateServiceBookingDto {
  @IsString()
  customerName!: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsString()
  vehicleReg!: string;

  @IsString()
  serviceType!: string;

  @IsDateString()
  requestedSlot!: string;
}

import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateCourtesyVehicleDto {
  @IsString()
  reg!: string;

  @IsString()
  make!: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsString()
  colour?: string;

  @IsOptional()
  @IsDateString()
  insuranceExpiry?: string;

  @IsOptional()
  @IsDateString()
  motExpiry?: string;

  @IsOptional()
  @IsDateString()
  taxExpiry?: string;
}

export class CreateBookingDto {
  @IsString()
  courtesyVehicleId!: string;

  @IsString()
  customerName!: string;

  @IsOptional()
  @IsString()
  linkedJobCardId?: string;

  @IsDateString()
  outDate!: string;

  @IsDateString()
  expectedReturnDate!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  outMileage?: number;
}

export class ReturnBookingDto {
  @IsInt()
  @Min(0)
  returnMileage!: number;

  @IsOptional()
  @IsString()
  newDamageNotes?: string;
}

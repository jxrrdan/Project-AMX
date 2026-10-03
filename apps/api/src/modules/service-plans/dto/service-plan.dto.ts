import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateServicePlanDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMonthly?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  intervalMonths?: number;
}

export class UpdateServicePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMonthly?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  intervalMonths?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateSubscriptionDto {
  @IsString()
  planId!: string;

  @IsString()
  customerName!: string;

  @IsString()
  vehicleReg!: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  accountCustomerId?: string;

  @IsOptional()
  @IsDateString()
  motDueDate?: string;

  @IsOptional()
  @IsDateString()
  serviceDueDate?: string;
}

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  accountCustomerId?: string;

  @IsOptional()
  @IsDateString()
  motDueDate?: string;

  @IsOptional()
  @IsDateString()
  serviceDueDate?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

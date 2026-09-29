import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateServiceHistoryEntryDto {
  @IsString()
  vehicleReg!: string;

  @IsOptional()
  @IsString()
  vin?: string;

  @IsString()
  entryType!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  mileage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsDateString()
  performedAt!: string;
}

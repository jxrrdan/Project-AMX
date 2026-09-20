import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePartRequirementDto {
  @IsOptional()
  @IsString()
  partId?: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

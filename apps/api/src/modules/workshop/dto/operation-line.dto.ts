import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateJobCardOperationLineDto {
  @IsString()
  description!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedMinutes?: number;
}

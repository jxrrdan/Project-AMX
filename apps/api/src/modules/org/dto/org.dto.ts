import { IsOptional, IsString } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  name!: string;
}

export class CreateFranchiseDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  brandCode?: string;

  @IsOptional()
  @IsString()
  groupId?: string;
}

export class AssignDealerFranchiseDto {
  @IsOptional()
  @IsString()
  franchiseId?: string | null;
}

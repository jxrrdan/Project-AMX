import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;
}

export class CreateFranchiseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  brandCode?: string;

  /** Proves the caller was invited into this group — the group's raw id is never accepted here. */
  @IsOptional()
  @IsString()
  groupJoinCode?: string;
}

export class AssignDealerFranchiseDto {
  /** Proves the caller was invited into this franchise — its raw id is never accepted here. Omit to leave this dealer's franchise. */
  @IsOptional()
  @IsString()
  franchiseJoinCode?: string;
}

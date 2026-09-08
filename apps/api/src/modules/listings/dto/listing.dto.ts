import { ListingPlatformType } from '@project-amx/shared';
import { IsBoolean, IsEnum } from 'class-validator';

export class SetPlatformDto {
  @IsEnum(ListingPlatformType)
  type!: ListingPlatformType;

  @IsBoolean()
  enabled!: boolean;
}

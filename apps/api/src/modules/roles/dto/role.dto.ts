import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsString, ValidateNested } from 'class-validator';
import { ModuleKey, PermissionAction } from '@project-amx/shared';

export class PermissionGrantDto {
  @IsEnum(ModuleKey)
  module!: ModuleKey;

  @IsEnum(PermissionAction)
  action!: PermissionAction;
}

export class CreateRoleDto {
  @IsString()
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PermissionGrantDto)
  permissions!: PermissionGrantDto[];
}

export class UpdateRoleDto extends CreateRoleDto {}

import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ModuleKey, PermissionAction } from '@project-amx/shared';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roleIds!: string[];
}

export class AcceptInvitationDto {
  @IsString()
  token!: string;

  @IsString()
  password!: string;
}

export class ModuleOverrideDto {
  @IsEnum(ModuleKey)
  module!: ModuleKey;

  @IsEnum(PermissionAction)
  action!: PermissionAction;

  @IsBoolean()
  allowed!: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleOverrideDto)
  moduleOverrides?: ModuleOverrideDto[];
}

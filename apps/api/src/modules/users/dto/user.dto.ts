import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
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

/** Self-service — a user editing their own record (never someone else's), so no ADMIN permission
 * is required; only fields safe for anyone to set on themselves belong here (phone number, for
 * SMS notifications — see NotificationsService). */
export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ]{7,15}$/, { message: 'Enter a valid phone number' })
  phone?: string | null;
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

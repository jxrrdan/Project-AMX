import { VehicleContactRole } from '@project-amx/shared';
import { IsEnum, IsString } from 'class-validator';

export class LinkVehicleContactDto {
  @IsString()
  contactId!: string;

  @IsEnum(VehicleContactRole)
  role!: VehicleContactRole;
}

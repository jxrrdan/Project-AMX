import { Module } from '@nestjs/common';
import { VehicleConditionService } from './vehicle-condition.service';

@Module({
  providers: [VehicleConditionService],
  exports: [VehicleConditionService],
})
export class VehicleConditionModule {}

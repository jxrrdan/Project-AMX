import { Module } from '@nestjs/common';
import { VehicleConditionModule } from '../vehicle-condition/vehicle-condition.module';
import { CourtesyController } from './courtesy.controller';
import { CourtesyService } from './courtesy.service';

@Module({
  imports: [VehicleConditionModule],
  controllers: [CourtesyController],
  providers: [CourtesyService],
})
export class CourtesyModule {}

import { Module } from '@nestjs/common';
import { UsedCarsController } from './used-cars.controller';
import { UsedCarsService } from './used-cars.service';

@Module({
  controllers: [UsedCarsController],
  providers: [UsedCarsService],
  exports: [UsedCarsService],
})
export class UsedCarsModule {}

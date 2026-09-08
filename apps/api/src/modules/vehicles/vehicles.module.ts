import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { PdiService } from './pdi.service';
import { HandoverService } from './handover.service';
import { RisImportService } from './ris-import.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [VehiclesController],
  providers: [VehiclesService, PdiService, HandoverService, RisImportService],
  exports: [VehiclesService, HandoverService],
})
export class VehiclesModule {}

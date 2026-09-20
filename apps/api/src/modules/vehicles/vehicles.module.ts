import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DealersModule } from '../dealers/dealers.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';
import { UsedCarsModule } from '../used-cars/used-cars.module';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { NewCarSaleService } from './new-car-sale.service';
import { PdiService } from './pdi.service';
import { HandoverService } from './handover.service';
import { RisImportService } from './ris-import.service';

@Module({
  imports: [ScheduleModule.forRoot(), DealersModule, DocumentTemplatesModule, UsedCarsModule],
  controllers: [VehiclesController],
  providers: [VehiclesService, PdiService, HandoverService, RisImportService, NewCarSaleService],
  exports: [VehiclesService, HandoverService],
})
export class VehiclesModule {}

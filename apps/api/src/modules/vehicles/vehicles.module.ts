import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DealersModule } from '../dealers/dealers.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';
import { LedgerModule } from '../ledger/ledger.module';
import { UsedCarsModule } from '../used-cars/used-cars.module';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { NewCarSaleService } from './new-car-sale.service';
import { PdiService } from './pdi.service';
import { HandoverService } from './handover.service';
import { RisImportService } from './ris-import.service';
import { VehicleContactsService } from './vehicle-contacts.service';

@Module({
  imports: [ScheduleModule.forRoot(), DealersModule, DocumentTemplatesModule, UsedCarsModule, LedgerModule],
  controllers: [VehiclesController],
  providers: [VehiclesService, PdiService, HandoverService, RisImportService, NewCarSaleService, VehicleContactsService],
  exports: [VehiclesService, HandoverService, VehicleContactsService],
})
export class VehiclesModule {}

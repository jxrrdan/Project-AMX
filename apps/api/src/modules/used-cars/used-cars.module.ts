import { Module } from '@nestjs/common';
import { ActionTriggersModule } from '../action-triggers/action-triggers.module';
import { DealersModule } from '../dealers/dealers.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';
import { LedgerModule } from '../ledger/ledger.module';
import { TradeInService } from './trade-in.service';
import { UsedCarsController } from './used-cars.controller';
import { UsedCarsService } from './used-cars.service';

@Module({
  imports: [DealersModule, DocumentTemplatesModule, ActionTriggersModule, LedgerModule],
  controllers: [UsedCarsController],
  providers: [UsedCarsService, TradeInService],
  exports: [UsedCarsService, TradeInService],
})
export class UsedCarsModule {}

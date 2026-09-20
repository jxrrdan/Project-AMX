import { Module } from '@nestjs/common';
import { ActionTriggersModule } from '../action-triggers/action-triggers.module';
import { DealersModule } from '../dealers/dealers.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';
import { UsedCarsController } from './used-cars.controller';
import { UsedCarsService } from './used-cars.service';

@Module({
  imports: [DealersModule, DocumentTemplatesModule, ActionTriggersModule],
  controllers: [UsedCarsController],
  providers: [UsedCarsService],
  exports: [UsedCarsService],
})
export class UsedCarsModule {}

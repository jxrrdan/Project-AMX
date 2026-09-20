import { Module } from '@nestjs/common';
import { DealersModule } from '../dealers/dealers.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';
import { UsedCarsController } from './used-cars.controller';
import { UsedCarsService } from './used-cars.service';

@Module({
  imports: [DealersModule, DocumentTemplatesModule],
  controllers: [UsedCarsController],
  providers: [UsedCarsService],
  exports: [UsedCarsService],
})
export class UsedCarsModule {}

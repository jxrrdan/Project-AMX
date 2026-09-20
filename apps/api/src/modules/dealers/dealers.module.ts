import { Module } from '@nestjs/common';
import { DealersController } from './dealers.controller';
import { DealersService } from './dealers.service';
import { DocumentSequenceService } from './document-sequence.service';

@Module({
  controllers: [DealersController],
  providers: [DealersService, DocumentSequenceService],
  exports: [DealersService, DocumentSequenceService],
})
export class DealersModule {}

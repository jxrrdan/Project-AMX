import { Module } from '@nestjs/common';
import { DealersModule } from '../dealers/dealers.module';
import { CreditNotesController } from './credit-notes.controller';
import { CreditNotesService } from './credit-notes.service';

@Module({
  imports: [DealersModule],
  controllers: [CreditNotesController],
  providers: [CreditNotesService],
})
export class CreditNotesModule {}

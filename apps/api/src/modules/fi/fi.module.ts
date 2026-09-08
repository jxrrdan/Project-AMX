import { Module } from '@nestjs/common';
import { FiController } from './fi.controller';
import { FiService } from './fi.service';

@Module({
  controllers: [FiController],
  providers: [FiService],
})
export class FiModule {}

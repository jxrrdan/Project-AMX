import { Module } from '@nestjs/common';
import { CourtesyController } from './courtesy.controller';
import { CourtesyService } from './courtesy.service';

@Module({
  controllers: [CourtesyController],
  providers: [CourtesyService],
})
export class CourtesyModule {}

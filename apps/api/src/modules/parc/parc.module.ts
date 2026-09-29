import { Module } from '@nestjs/common';
import { ParcController } from './parc.controller';
import { ParcService } from './parc.service';

@Module({
  controllers: [ParcController],
  providers: [ParcService],
})
export class ParcModule {}

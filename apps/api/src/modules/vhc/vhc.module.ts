import { Module } from '@nestjs/common';
import { VhcController } from './vhc.controller';
import { VhcService } from './vhc.service';

@Module({
  controllers: [VhcController],
  providers: [VhcService],
})
export class VhcModule {}

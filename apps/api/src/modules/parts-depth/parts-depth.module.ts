import { Module } from '@nestjs/common';
import { PartsDepthController } from './parts-depth.controller';
import { PartsDepthService } from './parts-depth.service';

@Module({
  controllers: [PartsDepthController],
  providers: [PartsDepthService],
})
export class PartsDepthModule {}

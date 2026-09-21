import { Module } from '@nestjs/common';
import { ActionTriggersController } from './action-triggers.controller';
import { ActionTriggersService } from './action-triggers.service';

@Module({
  controllers: [ActionTriggersController],
  providers: [ActionTriggersService],
  exports: [ActionTriggersService],
})
export class ActionTriggersModule {}

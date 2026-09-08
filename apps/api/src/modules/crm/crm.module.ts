import { Module } from '@nestjs/common';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CommunicationsService } from './communications.service';
import { WorkflowsService } from './workflows.service';

@Module({
  controllers: [CrmController],
  providers: [CrmService, CommunicationsService, WorkflowsService],
  exports: [CrmService],
})
export class CrmModule {}

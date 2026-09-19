import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { AiInsightsController } from './ai-insights.controller';
import { AiInsightsService } from './ai-insights.service';

@Module({
  imports: [DashboardModule],
  controllers: [AiInsightsController],
  providers: [AiInsightsService],
})
export class AiInsightsModule {}

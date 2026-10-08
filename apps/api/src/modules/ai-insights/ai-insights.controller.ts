import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import { CaptchaService } from '../../common/captcha/captcha.service';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AiInsightsService } from './ai-insights.service';
import { ChatbotMessageDto, ChatMessageDto, EmailDraftDto, NlQueryDto } from './dto/ai.dto';

@Controller('ai')
export class AiInsightsController {
  constructor(
    private readonly aiInsightsService: AiInsightsService,
    private readonly captcha: CaptchaService,
  ) {}

  @Get('daily-briefing')
  @RequirePermissions({ module: ModuleKey.AI_INSIGHTS, action: PermissionAction.VIEW })
  dailyBriefing(@CurrentUser() user: AuthUser) {
    return this.aiInsightsService.dailyBriefing(user.dealerId);
  }

  @Post('nl-query')
  @RequirePermissions({ module: ModuleKey.AI_INSIGHTS, action: PermissionAction.VIEW })
  nlQuery(@CurrentUser() user: AuthUser, @Body() dto: NlQueryDto) {
    return this.aiInsightsService.nlQuery(user.dealerId, dto);
  }

  @Get('leads/priority')
  @RequirePermissions({ module: ModuleKey.AI_INSIGHTS, action: PermissionAction.VIEW })
  priorityLeads(@CurrentUser() user: AuthUser) {
    return this.aiInsightsService.priorityLeads(user.dealerId);
  }

  @Get('leads/:id/next-best-action')
  @RequirePermissions({ module: ModuleKey.AI_INSIGHTS, action: PermissionAction.VIEW })
  nextBestAction(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.aiInsightsService.nextBestAction(user.dealerId, id);
  }

  @Post('email-draft')
  @RequirePermissions({ module: ModuleKey.AI_INSIGHTS, action: PermissionAction.VIEW })
  draftEmail(@CurrentUser() user: AuthUser, @Body() dto: EmailDraftDto) {
    return this.aiInsightsService.draftEmail(user.dealerId, dto);
  }

  @Get('workshop-suggestion')
  @RequirePermissions({ module: ModuleKey.AI_INSIGHTS, action: PermissionAction.VIEW })
  workshopSuggestion(@CurrentUser() user: AuthUser, @Query('jobType') jobType: string) {
    return this.aiInsightsService.workshopSuggestion(user.dealerId, jobType);
  }

  @Get('parts-forecast')
  @RequirePermissions({ module: ModuleKey.AI_INSIGHTS, action: PermissionAction.VIEW })
  partsForecast(@CurrentUser() user: AuthUser) {
    return this.aiInsightsService.partsForecast(user.dealerId);
  }

  @Post('assistant/chat')
  @RequirePermissions({ module: ModuleKey.AI_INSIGHTS, action: PermissionAction.VIEW })
  assistantChat(@CurrentUser() user: AuthUser, @Body() dto: ChatMessageDto) {
    return this.aiInsightsService.assistantChat(user.dealerId, user.id, dto);
  }

  /** Module 15 — public embeddable chatbot widget endpoint, no auth required. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @Post('dealers/:dealerId/chatbot')
  async chatbotMessage(@Param('dealerId') dealerId: string, @Body() dto: ChatbotMessageDto) {
    // Each message costs AI-provider spend, so the widget must pass a CAPTCHA like the other public forms.
    await this.captcha.verify(dto.captchaToken, dto.captchaAnswer);
    return this.aiInsightsService.chatbotMessage(dealerId, dto);
  }
}

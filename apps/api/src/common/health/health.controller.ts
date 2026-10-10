import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Liveness and readiness probes for the ALB / ECS health checks (infra expects GET /api/health).
 * Both are unauthenticated and exempt from rate limiting so a throttled probe can never take a
 * healthy task out of rotation. They expose no version or configuration detail.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Process is up. Deliberately does not touch the database, so a DB blip does not restart tasks. */
  @SkipThrottle()
  @Public()
  @Get()
  live() {
    return { status: 'ok' };
  }

  /** Can serve traffic: the database answers. */
  @SkipThrottle()
  @Public()
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable' });
    }
  }
}

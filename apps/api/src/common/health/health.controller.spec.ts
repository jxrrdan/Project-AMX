import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports liveness without touching the database', () => {
    const prisma = { $queryRaw: jest.fn() };
    expect(new HealthController(prisma as never).live()).toEqual({ status: 'ok' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('is ready when the database answers', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    await expect(new HealthController(prisma as never).ready()).resolves.toEqual({ status: 'ready' });
  });

  it('reports 503 when the database is down', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('down')) };
    await expect(new HealthController(prisma as never).ready()).rejects.toThrow(ServiceUnavailableException);
  });
});

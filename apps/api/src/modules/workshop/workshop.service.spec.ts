import { NotFoundException } from '@nestjs/common';
import { WorkshopService } from './workshop.service';

function makeService(prisma: Record<string, unknown>) {
  return new WorkshopService(prisma as never, { emitJobCardChanged: jest.fn() } as never, { record: jest.fn() } as never);
}

describe('WorkshopService.getPublicBoard', () => {
  it('throws when no dealer matches the given board token (e.g. a stale/revoked token, or a plain dealerId)', async () => {
    const findMany = jest.fn();
    const prisma = {
      dealer: { findUnique: jest.fn().mockResolvedValue(null) },
      jobCard: { findMany },
    };
    const service = makeService(prisma);
    await expect(service.getPublicBoard('not-a-real-token')).rejects.toThrow(NotFoundException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('resolves the dealer from the token and returns only that dealer\'s job cards', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'job-1' }]);
    const prisma = {
      dealer: { findUnique: jest.fn().mockResolvedValue({ id: 'dealer-1', workshopBoardToken: 'real-token' }) },
      jobCard: { findMany },
    };
    const service = makeService(prisma);
    const result = await service.getPublicBoard('real-token');
    expect(result).toEqual([{ id: 'job-1' }]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ dealerId: 'dealer-1' }) }));
  });
});

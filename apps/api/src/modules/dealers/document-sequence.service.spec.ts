import { NotFoundException } from '@nestjs/common';
import { DocumentSequenceService } from './document-sequence.service';

describe('DocumentSequenceService', () => {
  const dealerId = 'dealer-1';

  it('update refuses another dealer\'s sequence', async () => {
    const update = jest.fn();
    const prisma = { documentSequence: { findFirst: jest.fn().mockResolvedValue(null), update } };
    const service = new DocumentSequenceService(prisma as never);

    await expect(service.update(dealerId, 'other-dealer-seq', { prefix: 'X' })).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('nextNumber creates the row on first use and formats prefix-year-padded number', async () => {
    const year = new Date().getFullYear();
    const seqRow = { id: 'seq-1', dealerId, docType: 'DEAL_SHEET', prefix: 'DS', year, nextNumber: 1 };
    const tx = {
      documentSequence: {
        upsert: jest.fn().mockResolvedValue(seqRow),
        update: jest.fn().mockResolvedValue({ ...seqRow, nextNumber: 2 }),
      },
    };
    const prisma = { $transaction: jest.fn().mockImplementation((fn) => fn(tx)) };
    const service = new DocumentSequenceService(prisma as never);

    const result = await service.nextNumber(dealerId, 'DEAL_SHEET');

    expect(result).toBe(`DS-${year}-00001`);
    expect(tx.documentSequence.upsert).toHaveBeenCalledWith({
      where: { dealerId_docType_year: { dealerId, docType: 'DEAL_SHEET', year } },
      update: {},
      create: { dealerId, docType: 'DEAL_SHEET', year, prefix: 'DS', nextNumber: 1 },
    });
    expect(tx.documentSequence.update).toHaveBeenCalledWith({
      where: { id: 'seq-1' },
      data: { nextNumber: { increment: 1 } },
    });
  });

  it('falls back to a 3-letter prefix for an unrecognised doc type', async () => {
    const year = new Date().getFullYear();
    const seqRow = { id: 'seq-2', dealerId, docType: 'CUSTOM_DOC', prefix: 'CUS', year, nextNumber: 7 };
    const tx = {
      documentSequence: {
        upsert: jest.fn().mockResolvedValue(seqRow),
        update: jest.fn().mockResolvedValue({ ...seqRow, nextNumber: 8 }),
      },
    };
    const prisma = { $transaction: jest.fn().mockImplementation((fn) => fn(tx)) };
    const service = new DocumentSequenceService(prisma as never);

    const result = await service.nextNumber(dealerId, 'CUSTOM_DOC');

    expect(result).toBe(`CUS-${year}-00007`);
  });
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreditNoteStatus } from '@project-amx/shared';
import { CreditNotesService } from './credit-notes.service';

const dealerId = 'dealer-1';

describe('CreditNotesService', () => {
  it('computes per-line net totals and rolled-up subtotal/tax/total on create', async () => {
    const prisma = { creditNote: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'cn-1', ...data })) } };
    const service = new CreditNotesService(prisma as never, {} as never);
    await service.create(dealerId, {
      customerName: 'Acme',
      reason: 'Overcharge',
      lines: [
        { description: 'A', quantity: 2, unitPrice: 30, taxRate: 0.2 },
        { description: 'B', quantity: 1, unitPrice: 10, taxRate: 0.2 },
      ],
    });
    const data = prisma.creditNote.create.mock.calls[0][0].data;
    expect(data.subtotal).toBe(70); // 60 + 10
    expect(data.taxAmount).toBe(14); // 20% of 70
    expect(data.total).toBe(84);
  });

  it('issues a draft: reserves a document number and sets status ISSUED', async () => {
    const prisma = {
      creditNote: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cn-1', dealerId, status: CreditNoteStatus.DRAFT, number: null }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'cn-1', ...data })),
      },
    };
    const sequences = { nextNumber: jest.fn().mockResolvedValue('CN-2026-00001') };
    const service = new CreditNotesService(prisma as never, sequences as never);
    const result = await service.issue(dealerId, 'cn-1');
    expect(sequences.nextNumber).toHaveBeenCalledWith(dealerId, 'CREDIT_NOTE');
    expect(result.number).toBe('CN-2026-00001');
    expect(result.status).toBe(CreditNoteStatus.ISSUED);
  });

  it('refuses to edit a non-draft credit note', async () => {
    const prisma = { creditNote: { findFirst: jest.fn().mockResolvedValue({ id: 'cn-1', dealerId, status: CreditNoteStatus.ISSUED }) } };
    const service = new CreditNotesService(prisma as never, {} as never);
    await expect(service.update(dealerId, 'cn-1', { reason: 'x' })).rejects.toThrow(BadRequestException);
  });

  it('throws when the credit note is not owned by the dealer', async () => {
    const prisma = { creditNote: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new CreditNotesService(prisma as never, {} as never);
    await expect(service.issue(dealerId, 'cn-x')).rejects.toThrow(NotFoundException);
  });
});

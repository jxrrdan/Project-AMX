import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AftersalesInvoiceService } from './aftersales-invoice.service';

function makePdf() {
  return { renderAndStore: jest.fn().mockResolvedValue('https://files.local/aftersales-invoices/invoice-1.html') };
}

function makeDocumentSequences() {
  return { nextNumber: jest.fn().mockResolvedValue('INV-2026-00001') };
}

function makeDocumentTemplates() {
  return { getDefaultBody: jest.fn().mockResolvedValue('<html></html>') };
}

function makeLedger() {
  return { postSafely: jest.fn() };
}

describe('AftersalesInvoiceService.generate', () => {
  const dealerId = 'dealer-1';
  const jobCardId = 'job-1';

  it('throws when the job card does not belong to this dealer', async () => {
    const prisma = { jobCard: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new AftersalesInvoiceService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeLedger() as never);
    await expect(service.generate(dealerId, jobCardId)).rejects.toThrow(NotFoundException);
  });

  it('refuses to invoice a warranty job — that goes through a warranty claim instead', async () => {
    const prisma = {
      jobCard: { findFirst: jest.fn().mockResolvedValue({ id: jobCardId, billingType: 'WARRANTY', timeEntries: [], operationLines: [], partAllocations: [] }) },
      aftersalesInvoice: { findUnique: jest.fn() },
    };
    const service = new AftersalesInvoiceService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeLedger() as never);
    await expect(service.generate(dealerId, jobCardId)).rejects.toThrow(BadRequestException);
    expect(prisma.aftersalesInvoice.findUnique).not.toHaveBeenCalled();
  });

  it('bills an internal job to the dealer\'s own accounts, not the customer, and flags it as such', async () => {
    const prisma = {
      jobCard: {
        findFirst: jest.fn().mockResolvedValue({
          id: jobCardId,
          billingType: 'INTERNAL',
          customerName: 'Jamie Smith',
          vehicleReg: 'AB12CDE',
          jobType: 'PDI',
          estimatedHours: 1,
          timeEntries: [],
          operationLines: [],
          partAllocations: [],
        }),
      },
      aftersalesInvoice: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(({ data }) => data) },
      dealer: { findUnique: jest.fn().mockResolvedValue({ labourRatePerHour: 100, name: 'Test Dealer' }) },
    };
    const service = new AftersalesInvoiceService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeLedger() as never);

    const result = await service.generate(dealerId, jobCardId);

    expect(result.isInternal).toBe(true);
    expect(result.recipient).toBe('Test Dealer — internal accounts');
  });

  it('refuses to generate a second invoice for the same job card', async () => {
    const prisma = {
      jobCard: { findFirst: jest.fn().mockResolvedValue({ id: jobCardId, timeEntries: [], operationLines: [], partAllocations: [] }) },
      aftersalesInvoice: { findUnique: jest.fn().mockResolvedValue({ id: 'existing-invoice' }) },
    };
    const service = new AftersalesInvoiceService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeLedger() as never);
    await expect(service.generate(dealerId, jobCardId)).rejects.toThrow(BadRequestException);
  });

  it('computes labour from clocked time when available, at the dealer\'s configured rate', async () => {
    const clockOn = new Date('2026-09-20T09:00:00Z');
    const clockOff = new Date('2026-09-20T11:00:00Z'); // 2 hours
    const prisma = {
      jobCard: {
        findFirst: jest.fn().mockResolvedValue({
          id: jobCardId,
          customerName: 'Jamie Smith',
          vehicleReg: 'AB12CDE',
          jobType: 'SERVICE',
          estimatedHours: 1,
          timeEntries: [{ clockOn, clockOff }],
          operationLines: [],
          partAllocations: [],
        }),
      },
      aftersalesInvoice: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(({ data }) => data) },
      dealer: { findUnique: jest.fn().mockResolvedValue({ labourRatePerHour: 100, name: 'Test Dealer' }) },
    };
    const service = new AftersalesInvoiceService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeLedger() as never);

    const result = await service.generate(dealerId, jobCardId);

    // 2 hours clocked * £100/hr = £200 labour; no parts; VAT 20% of 200 = £40; total £240
    expect(result.labourTotal).toBe(200);
    expect(result.partsTotal).toBe(0);
    expect(result.vatAmount).toBe(40);
    expect(result.totalAmount).toBe(240);
  });

  it('sums per-line clock entries instead of whole-job time entries once a job card has operation lines', async () => {
    const lineClockOn = new Date('2026-09-20T09:00:00Z');
    const lineClockOff = new Date('2026-09-20T09:30:00Z'); // 30 min on the line
    const wholeJobClockOn = new Date('2026-09-20T08:00:00Z');
    const wholeJobClockOff = new Date('2026-09-20T12:00:00Z'); // 4h — should be ignored once lines exist
    const prisma = {
      jobCard: {
        findFirst: jest.fn().mockResolvedValue({
          id: jobCardId,
          customerName: 'Jamie Smith',
          vehicleReg: 'AB12CDE',
          jobType: 'SERVICE',
          estimatedHours: 1,
          timeEntries: [{ clockOn: wholeJobClockOn, clockOff: wholeJobClockOff }],
          operationLines: [{ clockEntries: [{ clockOn: lineClockOn, clockOff: lineClockOff }] }],
          partAllocations: [],
        }),
      },
      aftersalesInvoice: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(({ data }) => data) },
      dealer: { findUnique: jest.fn().mockResolvedValue({ labourRatePerHour: 100 }) },
    };
    const service = new AftersalesInvoiceService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeLedger() as never);

    const result = await service.generate(dealerId, jobCardId);

    // 0.5h clocked on the line * £100/hr = £50, NOT the 4h whole-job entry's £400.
    expect(result.labourTotal).toBe(50);
  });

  it('falls back to the estimated hours when nobody clocked off', async () => {
    const prisma = {
      jobCard: {
        findFirst: jest.fn().mockResolvedValue({
          id: jobCardId,
          customerName: 'Jamie Smith',
          vehicleReg: 'AB12CDE',
          jobType: 'SERVICE',
          estimatedHours: 3,
          timeEntries: [],
          operationLines: [],
          partAllocations: [],
        }),
      },
      aftersalesInvoice: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(({ data }) => data) },
      dealer: { findUnique: jest.fn().mockResolvedValue({ labourRatePerHour: 100 }) },
    };
    const service = new AftersalesInvoiceService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeLedger() as never);

    const result = await service.generate(dealerId, jobCardId);

    expect(result.labourTotal).toBe(300);
  });

  it('sums parts at cost price into partsTotal', async () => {
    const prisma = {
      jobCard: {
        findFirst: jest.fn().mockResolvedValue({
          id: jobCardId,
          customerName: 'Jamie Smith',
          vehicleReg: 'AB12CDE',
          jobType: 'SERVICE',
          estimatedHours: 0,
          timeEntries: [],
          operationLines: [],
          partAllocations: [
            { quantity: 2, part: { description: 'Oil filter', costPrice: 10 } },
            { quantity: 1, part: { description: 'Brake disc', costPrice: 45.5 } },
          ],
        }),
      },
      aftersalesInvoice: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(({ data }) => data) },
      dealer: { findUnique: jest.fn().mockResolvedValue({ labourRatePerHour: 100 }) },
    };
    const service = new AftersalesInvoiceService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeLedger() as never);

    const result = await service.generate(dealerId, jobCardId);

    // parts: 2*10 + 1*45.5 = 65.5
    expect(result.partsTotal).toBe(65.5);
  });
});

describe('AftersalesInvoiceService.get', () => {
  it('throws when no invoice has been generated for this job card', async () => {
    const prisma = { aftersalesInvoice: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new AftersalesInvoiceService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeLedger() as never);
    await expect(service.get('dealer-1', 'job-1')).rejects.toThrow(NotFoundException);
  });

  it('scopes the lookup to the given dealer', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'inv-1' });
    const prisma = { aftersalesInvoice: { findFirst } };
    const service = new AftersalesInvoiceService(prisma as never, makePdf() as never, makeDocumentSequences() as never, makeDocumentTemplates() as never, makeLedger() as never);
    await service.get('dealer-1', 'job-1');
    expect(findFirst).toHaveBeenCalledWith({ where: { jobCardId: 'job-1', dealerId: 'dealer-1' } });
  });
});

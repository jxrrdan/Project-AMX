import { AiInvoiceExtractionService } from './ai-invoice-extraction.service';

describe('AiInvoiceExtractionService.extract', () => {
  it('pulls invoice number, date and amounts out of loosely formatted invoice text', () => {
    const service = new AiInvoiceExtractionService();
    const text = `
      From: ACME Parts Ltd
      Invoice Number: INV-88213
      Invoice Date: 12/01/2026
      Net Amount: £450.00
      VAT: £90.00
      Total Due: £540.00
    `;
    const result = service.extract(text);
    expect(result.invoiceNumber).toBe('INV-88213');
    expect(result.invoiceDate).toBe('12/01/2026');
    expect(result.netAmount).toBe(450);
    expect(result.vatAmount).toBe(90);
    expect(result.totalAmount).toBe(540);
    expect(result.supplierName).toContain('ACME');
  });

  it('returns nulls for fields it cannot find rather than throwing', () => {
    const service = new AiInvoiceExtractionService();
    const result = service.extract('not an invoice at all');
    expect(result.invoiceNumber).toBeNull();
    expect(result.netAmount).toBeNull();
  });
});

import { Injectable, Logger } from '@nestjs/common';

export interface ExtractedInvoiceData {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  netAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  supplierName: string | null;
}

const PATTERNS: Record<keyof ExtractedInvoiceData, RegExp> = {
  invoiceNumber: /invoice\s*(?:no\.?|number|ref)\s*[:#]?\s*([A-Z0-9-/]+)/i,
  invoiceDate: /(?:invoice\s*date|date)\s*[:#]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
  netAmount: /(?:net(?:\s*(?:amount|total))?|sub\s*-?\s*total)\s*[:#]?\s*£?\s*([\d,]+\.\d{2})/i,
  vatAmount: /vat\s*(?:amount|@\s*\d+%)?\s*[:#]?\s*£?\s*([\d,]+\.\d{2})/i,
  totalAmount: /(?:total\s*(?:due|amount)?|grand\s*total|amount\s*due)\s*[:#]?\s*£?\s*([\d,]+\.\d{2})/i,
  supplierName: /(?:from|supplier|vendor)\s*[:#]?\s*([A-Za-z0-9&.,'\s]{3,60})/i,
};

/**
 * AI invoice processing — heuristic regex extraction from OCR/emailed invoice text, used to
 * prefill the supplier-invoice creation form. Mocked the same way DVLA lookup and Xero/Sage sync
 * are mocked elsewhere: a production build would swap this for a real OCR + LLM extraction call
 * behind the same interface, no caller-side changes needed.
 */
@Injectable()
export class AiInvoiceExtractionService {
  private readonly logger = new Logger(AiInvoiceExtractionService.name);

  extract(text: string): ExtractedInvoiceData {
    this.logger.log('[AI invoice extraction mock] parsing pasted/OCR invoice text');

    const matchNumber = (pattern: RegExp) => {
      const match = text.match(pattern);
      return match ? Number(match[1].replace(/,/g, '')) : null;
    };
    const matchText = (pattern: RegExp) => {
      const match = text.match(pattern);
      return match ? match[1].trim() : null;
    };

    return {
      invoiceNumber: matchText(PATTERNS.invoiceNumber),
      invoiceDate: matchText(PATTERNS.invoiceDate),
      netAmount: matchNumber(PATTERNS.netAmount),
      vatAmount: matchNumber(PATTERNS.vatAmount),
      totalAmount: matchNumber(PATTERNS.totalAmount),
      supplierName: matchText(PATTERNS.supplierName),
    };
  }
}

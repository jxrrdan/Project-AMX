import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import { StorageService } from '../storage/storage.service';

/**
 * Document generation abstraction: Handlebars template → Puppeteer → PDF → S3, per the
 * architecture spec (used for PDI checklists, deal sheets, invoices, handover/condition
 * reports). Puppeteer needs a bundled Chromium (~300MB) that isn't worth pulling into a local
 * dev environment, so PDF_DRIVER=html (the default here) renders the same Handlebars template
 * and stores it as an .html file via StorageService — open it in a browser and Ctrl+P → Save as
 * PDF to see the real output. Swap the `html` branch below for a Puppeteer `page.pdf()` call
 * behind this same interface for production.
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly driver: string;

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {
    this.driver = this.config.get<string>('PDF_DRIVER', 'html');
  }

  async renderAndStore(
    dealerId: string,
    category: string,
    filename: string,
    templateSource: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    const template = Handlebars.compile(templateSource);
    const html = template(context);

    if (this.driver === 'html') {
      return this.storage.put(dealerId, category, `${filename}.html`, Buffer.from(html, 'utf-8'));
    }

    if (this.driver === 'puppeteer') {
      const pdf = await this.renderPdf(html);
      return this.storage.put(dealerId, category, `${filename}.pdf`, pdf);
    }

    throw new Error(`Unknown PDF_DRIVER "${this.driver}"`);
  }

  /**
   * Renders HTML to PDF with headless Chromium (PUPPETEER_EXECUTABLE_PATH; installed in the API
   * image). Templates can contain customer-supplied text, so the page runs with JavaScript off and
   * every network request blocked — it can neither execute script nor reach internal services.
   */
  private async renderPdf(html: string): Promise<Buffer> {
    const puppeteer = await import('puppeteer-core');
    const browser = await puppeteer.launch({
      executablePath: this.config.getOrThrow<string>('PUPPETEER_EXECUTABLE_PATH'),
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      headless: true,
    });
    try {
      const page = await browser.newPage();
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', (req) => (req.url().startsWith('data:') || req.url() === 'about:blank' ? req.continue() : req.abort()));
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      return Buffer.from(await page.pdf({ format: 'A4', printBackground: true, margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' } }));
    } finally {
      await browser.close();
    }
  }
}

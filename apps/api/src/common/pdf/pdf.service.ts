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

    this.logger.warn(`PDF driver "${this.driver}" not implemented locally; storing HTML instead`);
    return this.storage.put(dealerId, category, `${filename}.html`, Buffer.from(html, 'utf-8'));
  }
}

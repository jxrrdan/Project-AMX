import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface VehicleValuation {
  registrationNumber: string;
  tradeValue: number;
  privateRetailValue: number;
  partExchangeValue: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Live used-vehicle market valuation. Production target is CAP HPI, Cazana, or Auto Trader's
 * valuation API — the "suggested price" feature every real DMS (Keyloop, Pinewood.AI) offers on
 * top of a dealer's own asking-price history; VALUATION_DRIVER=mock derives a deterministic fake
 * valuation from the registration + mileage (seeded the same way DvlaService seeds its fake spec,
 * so looking up the same plate/mileage twice gives the same answer) since the real services need
 * a paid data-licence this sandbox has no way to obtain.
 */
@Injectable()
export class VehicleValuationService {
  private readonly logger = new Logger(VehicleValuationService.name);
  private readonly driver: string;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('VALUATION_DRIVER', 'mock');
  }

  async getValuation(registrationNumber: string, mileage: number): Promise<VehicleValuation> {
    const reg = registrationNumber.trim().toUpperCase().replace(/\s+/g, '');

    if (this.driver === 'mock') {
      const seed = [...reg].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
      const basePrice = 8000 + (seed % 40) * 500;
      const mileageAdjustment = Math.max(0, 1 - mileage / 150_000);
      const privateRetailValue = Math.round(basePrice * mileageAdjustment);
      const partExchangeValue = Math.round(privateRetailValue * 0.85);
      const tradeValue = Math.round(privateRetailValue * 0.75);
      this.logger.log(`[valuation mock] ${reg} @ ${mileage}mi → retail £${privateRetailValue}`);
      return {
        registrationNumber: reg,
        tradeValue,
        privateRetailValue,
        partExchangeValue,
        confidence: mileage > 0 ? 'MEDIUM' : 'LOW',
      };
    }

    this.logger.warn(`Valuation driver "${this.driver}" not implemented locally`);
    throw new Error('Vehicle valuation is not configured for this environment');
  }
}

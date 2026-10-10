import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface DvlaVehicleSpec {
  registrationNumber: string;
  make: string;
  colour: string;
  fuelType: string;
  transmission: string;
  yearOfManufacture: number;
  engineCapacity: number;
  motStatus: 'Valid' | 'No details held by DVLA';
  taxStatus: 'Taxed' | 'SORN';
}

const MOCK_MAKES: { make: string; fuel: string; transmission: string }[] = [
  { make: 'BMW', fuel: 'Petrol', transmission: 'Automatic' },
  { make: 'BMW', fuel: 'Diesel', transmission: 'Manual' },
  { make: 'MINI', fuel: 'Petrol', transmission: 'Manual' },
  { make: 'BMW', fuel: 'Hybrid', transmission: 'Automatic' },
];
const MOCK_COLOURS = ['Black', 'White', 'Grey', 'Blue', 'Silver', 'Red'];

/**
 * Module 4.1 "DVLA API integration — automatic spec lookup by registration number". Production
 * target is the real DVLA Vehicle Enquiry Service (https://driver-vehicle-licensing.api.gov.uk);
 * DVLA_DRIVER=mock returns a deterministic fake spec (seeded from the registration string, so
 * looking up the same plate twice gives the same answer) since the real service needs a
 * government-issued API key this sandbox has no way to obtain.
 */
@Injectable()
export class DvlaService {
  private readonly logger = new Logger(DvlaService.name);
  private readonly driver: string;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('DVLA_DRIVER', 'mock');
  }

  async lookup(registrationNumber: string): Promise<DvlaVehicleSpec> {
    const reg = registrationNumber.trim().toUpperCase().replace(/\s+/g, '');
    if (!reg) {
      throw new NotFoundException('No registration number provided');
    }

    if (this.driver === 'mock') {
      const seed = [...reg].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
      const vehicle = MOCK_MAKES[seed % MOCK_MAKES.length];
      return {
        registrationNumber: reg,
        make: vehicle.make,
        colour: MOCK_COLOURS[seed % MOCK_COLOURS.length],
        fuelType: vehicle.fuel,
        transmission: vehicle.transmission,
        yearOfManufacture: 2016 + (seed % 9),
        engineCapacity: 1500 + (seed % 6) * 500,
        motStatus: seed % 5 === 0 ? 'No details held by DVLA' : 'Valid',
        taxStatus: seed % 7 === 0 ? 'SORN' : 'Taxed',
      };
    }

    if (this.driver === 'live') {
      try {
        const { data } = await axios.post<{
          registrationNumber: string;
          make?: string;
          colour?: string;
          fuelType?: string;
          yearOfManufacture?: number;
          engineCapacity?: number;
          motStatus?: string;
          taxStatus?: string;
        }>(
          this.config.get<string>('DVLA_API_URL', 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles'),
          { registrationNumber: reg },
          { headers: { 'x-api-key': this.config.getOrThrow<string>('DVLA_API_KEY') }, timeout: 10_000 },
        );
        return {
          registrationNumber: data.registrationNumber,
          make: data.make ?? 'Unknown',
          colour: data.colour ?? 'Unknown',
          fuelType: data.fuelType ?? 'Unknown',
          transmission: 'Unknown', // not provided by the Vehicle Enquiry Service
          yearOfManufacture: data.yearOfManufacture ?? 0,
          engineCapacity: data.engineCapacity ?? 0,
          motStatus: data.motStatus === 'Valid' ? 'Valid' : 'No details held by DVLA',
          taxStatus: data.taxStatus === 'Taxed' ? 'Taxed' : 'SORN',
        };
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          throw new NotFoundException('Vehicle not found at DVLA');
        }
        this.logger.warn(`DVLA lookup failed: ${err instanceof Error ? err.message : err}`);
        throw new ServiceUnavailableException('DVLA lookup is temporarily unavailable');
      }
    }

    throw new Error(`Unknown DVLA_DRIVER "${this.driver}"`);
  }
}

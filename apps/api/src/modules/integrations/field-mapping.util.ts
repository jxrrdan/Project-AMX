import { IntegrationTargetEntity } from '@project-amx/shared';

/** Every AMX column an inbound integration mapping is allowed to write, per target entity. */
export const TARGET_ENTITY_FIELDS: Record<IntegrationTargetEntity, { field: string; label: string }[]> = {
  [IntegrationTargetEntity.VEHICLE]: [
    { field: 'vin', label: 'VIN' },
    { field: 'model', label: 'Model' },
    { field: 'colour', label: 'Colour' },
    { field: 'customerName', label: 'Customer name' },
    { field: 'eta', label: 'ETA' },
    { field: 'status', label: 'Pipeline status' },
    { field: 'risOrderRef', label: 'OEM order reference' },
  ],
  [IntegrationTargetEntity.USED_VEHICLE]: [
    { field: 'reg', label: 'Registration' },
    { field: 'vin', label: 'VIN' },
    { field: 'make', label: 'Make' },
    { field: 'model', label: 'Model' },
    { field: 'colour', label: 'Colour' },
    { field: 'mileage', label: 'Mileage' },
    { field: 'fuel', label: 'Fuel type' },
    { field: 'transmission', label: 'Transmission' },
    { field: 'purchasePrice', label: 'Purchase price' },
    { field: 'askingPrice', label: 'Asking price' },
    { field: 'source', label: 'Source' },
    { field: 'status', label: 'Status' },
  ],
  [IntegrationTargetEntity.PART]: [
    { field: 'partNumber', label: 'Part number' },
    { field: 'description', label: 'Description' },
    { field: 'binLocation', label: 'Bin location' },
    { field: 'quantityOnHand', label: 'Quantity on hand' },
    { field: 'reorderLevel', label: 'Reorder level' },
    { field: 'costPrice', label: 'Cost price' },
  ],
  [IntegrationTargetEntity.CONTACT]: [
    { field: 'firstName', label: 'First name' },
    { field: 'lastName', label: 'Last name' },
    { field: 'email', label: 'Email' },
    { field: 'phone', label: 'Phone' },
    { field: 'gdprConsent', label: 'GDPR consent' },
    { field: 'emailOptIn', label: 'Email opt-in' },
    { field: 'smsOptIn', label: 'SMS opt-in' },
  ],
};

/** Numeric/boolean/date columns that need coercion out of a JSON payload's raw value before Prisma will accept them. */
const NUMERIC_FIELDS = new Set(['mileage', 'purchasePrice', 'askingPrice', 'quantityOnHand', 'reorderLevel', 'costPrice']);
const BOOLEAN_FIELDS = new Set(['gdprConsent', 'emailOptIn', 'smsOptIn']);
const DATE_FIELDS = new Set(['eta']);

export function isKnownTargetField(entity: IntegrationTargetEntity, field: string): boolean {
  return TARGET_ENTITY_FIELDS[entity].some((f) => f.field === field);
}

/** The Prisma model backing each target entity — shared by the ingest engine and the generic record/screen lookups. */
export const ENTITY_MODEL_NAME: Record<IntegrationTargetEntity, 'vehicle' | 'usedVehicle' | 'part' | 'contact'> = {
  [IntegrationTargetEntity.VEHICLE]: 'vehicle',
  [IntegrationTargetEntity.USED_VEHICLE]: 'usedVehicle',
  [IntegrationTargetEntity.PART]: 'part',
  [IntegrationTargetEntity.CONTACT]: 'contact',
};

/** Resolves a dot/bracket path ("a.b[0].c") against an arbitrary JSON-shaped payload. */
export function resolvePath(payload: unknown, path: string): unknown {
  const tokens = path.match(/[^.[\]]+/g) ?? [];
  let current: unknown = payload;
  for (const token of tokens) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

export function applyTransform(value: unknown, transform?: string | null): unknown {
  if (value === undefined || value === null) return value;
  switch (transform) {
    case 'UPPERCASE':
      return String(value).toUpperCase();
    case 'LOWERCASE':
      return String(value).toLowerCase();
    case 'TRIM':
      return String(value).trim();
    case 'PARSE_NUMBER': {
      const n = Number(value);
      return Number.isNaN(n) ? value : n;
    }
    case 'PARSE_DATE': {
      const d = new Date(value as string | number);
      return Number.isNaN(d.getTime()) ? value : d;
    }
    default:
      return value;
  }
}

/** Coerces a mapped value into the shape Prisma expects for a known column, based on its type in the schema. */
export function coerceForColumn(field: string, value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (NUMERIC_FIELDS.has(field)) {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(n) ? undefined : n;
  }
  if (BOOLEAN_FIELDS.has(field)) {
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true' || value === 1 || value === '1';
  }
  if (DATE_FIELDS.has(field)) {
    const d = value instanceof Date ? value : new Date(value as string | number);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return value;
}

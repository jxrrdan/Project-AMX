import { IntegrationTargetEntity } from '@project-amx/shared';
import { applyTransform, coerceForColumn, isKnownTargetField, resolvePath } from './field-mapping.util';

describe('resolvePath', () => {
  it('resolves a simple dot path', () => {
    expect(resolvePath({ vehicle: { vin: 'ABC123' } }, 'vehicle.vin')).toBe('ABC123');
  });

  it('resolves a bracketed array index', () => {
    expect(resolvePath({ items: [{ sku: 'P-1' }, { sku: 'P-2' }] }, 'items[1].sku')).toBe('P-2');
  });

  it('resolves a top-level array', () => {
    expect(resolvePath([{ vin: 'X' }], '[0].vin')).toBe('X');
  });

  it('returns undefined for a path that does not exist', () => {
    expect(resolvePath({ a: { b: 1 } }, 'a.c.d')).toBeUndefined();
  });

  it('returns undefined rather than throwing when traversing through null', () => {
    expect(resolvePath({ a: null }, 'a.b')).toBeUndefined();
  });
});

describe('applyTransform', () => {
  it('passes the value through unchanged with no transform', () => {
    expect(applyTransform('Hello', undefined)).toBe('Hello');
  });

  it('uppercases', () => {
    expect(applyTransform('abc', 'UPPERCASE')).toBe('ABC');
  });

  it('lowercases', () => {
    expect(applyTransform('ABC', 'LOWERCASE')).toBe('abc');
  });

  it('trims', () => {
    expect(applyTransform('  abc  ', 'TRIM')).toBe('abc');
  });

  it('parses a number', () => {
    expect(applyTransform('42', 'PARSE_NUMBER')).toBe(42);
  });

  it('leaves an unparseable number unchanged', () => {
    expect(applyTransform('not-a-number', 'PARSE_NUMBER')).toBe('not-a-number');
  });

  it('parses a date', () => {
    const result = applyTransform('2026-01-01', 'PARSE_DATE');
    expect(result).toBeInstanceOf(Date);
  });

  it('passes null/undefined through untouched regardless of transform', () => {
    expect(applyTransform(null, 'UPPERCASE')).toBeNull();
    expect(applyTransform(undefined, 'UPPERCASE')).toBeUndefined();
  });
});

describe('coerceForColumn', () => {
  it('coerces a numeric column from a string', () => {
    expect(coerceForColumn('mileage', '12000')).toBe(12000);
  });

  it('coerces a boolean column from a string', () => {
    expect(coerceForColumn('gdprConsent', 'true')).toBe(true);
    expect(coerceForColumn('gdprConsent', 'false')).toBe(false);
  });

  it('coerces a date column from a string', () => {
    const result = coerceForColumn('eta', '2026-06-01');
    expect(result).toBeInstanceOf(Date);
  });

  it('returns undefined for an uncoercible numeric value rather than throwing', () => {
    expect(coerceForColumn('mileage', 'not-a-number')).toBeUndefined();
  });

  it('leaves a plain string column untouched', () => {
    expect(coerceForColumn('vin', 'WBA123')).toBe('WBA123');
  });
});

describe('isKnownTargetField', () => {
  it('accepts a real column on the entity', () => {
    expect(isKnownTargetField(IntegrationTargetEntity.VEHICLE, 'vin')).toBe(true);
  });

  it('rejects a field not in the allowlist (e.g. dealerId, id, or a made-up column)', () => {
    expect(isKnownTargetField(IntegrationTargetEntity.VEHICLE, 'dealerId')).toBe(false);
    expect(isKnownTargetField(IntegrationTargetEntity.VEHICLE, 'id')).toBe(false);
    expect(isKnownTargetField(IntegrationTargetEntity.VEHICLE, 'notARealColumn')).toBe(false);
  });

  it('does not leak fields across entities', () => {
    expect(isKnownTargetField(IntegrationTargetEntity.CONTACT, 'vin')).toBe(false);
  });
});

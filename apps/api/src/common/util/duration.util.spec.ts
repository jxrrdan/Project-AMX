import { parseDurationToSeconds } from './duration.util';

describe('parseDurationToSeconds', () => {
  it('parses seconds', () => {
    expect(parseDurationToSeconds('30s')).toBe(30);
  });

  it('parses minutes', () => {
    expect(parseDurationToSeconds('15m')).toBe(15 * 60);
  });

  it('parses hours', () => {
    expect(parseDurationToSeconds('2h')).toBe(2 * 3600);
  });

  it('parses days', () => {
    expect(parseDurationToSeconds('7d')).toBe(7 * 86400);
  });

  it('throws on an invalid duration string', () => {
    expect(() => parseDurationToSeconds('nonsense')).toThrow();
  });
});

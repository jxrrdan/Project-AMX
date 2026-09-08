const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** Parses a simple duration string ("15m", "7d") to seconds, since @nestjs/jwt's typings want a number here. */
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration string: ${value}`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_SECONDS[unit];
}

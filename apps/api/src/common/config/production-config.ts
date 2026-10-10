/**
 * Fail-fast configuration check, run at boot when NODE_ENV=production. A misconfigured production
 * deploy (dev default secrets, mock drivers silently "succeeding", wildcard CORS) is the commonest
 * way a working app ships insecure, so the process refuses to start instead of limping on.
 *
 * ALLOW_MOCK_DRIVERS=true marks the local production-shaped Docker stack (docker-compose.prod.yml):
 * it permits mock drivers, localhost CORS and placeholder-looking secrets. Missing or short secrets
 * are always rejected. Never set it in a real deployment.
 */
const SECRET_KEYS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CAPTCHA_SECRET'] as const;
const DEV_DEFAULT = /(change-me|^dev-|^local-|^secret$|^changeme)/i;
const MIN_SECRET_LENGTH = 32;

/** Drivers that must be a real implementation in production, with the value that means "real". */
const REAL_DRIVERS: Record<string, string[]> = {
  STORAGE_DRIVER: ['s3'],
  EMAIL_DRIVER: ['ses'],
  AI_DRIVER: ['bedrock'],
  CAPTCHA_DRIVER: ['turnstile'],
  DVLA_DRIVER: ['live'],
  PDF_DRIVER: ['puppeteer'],
};

export function validateProductionConfig(env: Record<string, string | undefined>): string[] {
  if (env['NODE_ENV'] !== 'production') {
    return [];
  }
  const problems: string[] = [];
  const localStack = env['ALLOW_MOCK_DRIVERS'] === 'true';

  for (const key of SECRET_KEYS) {
    const value = env[key];
    if (!value) {
      problems.push(`${key} is not set`);
    } else if (value.length < MIN_SECRET_LENGTH || (!localStack && DEV_DEFAULT.test(value))) {
      problems.push(`${key} is a dev default or shorter than ${MIN_SECRET_LENGTH} characters`);
    }
  }
  if (env['JWT_ACCESS_SECRET'] && env['JWT_ACCESS_SECRET'] === env['JWT_REFRESH_SECRET']) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }

  const cors = env['CORS_ORIGIN'];
  if (!cors || cors === '*' || (!localStack && cors.includes('localhost'))) {
    problems.push('CORS_ORIGIN must be the real web origin (not unset, "*" or localhost)');
  }
  if (!env['DATABASE_URL']) {
    problems.push('DATABASE_URL is not set');
  }

  if (!localStack) {
    for (const [key, allowed] of Object.entries(REAL_DRIVERS)) {
      if (!allowed.includes(env[key] ?? '')) {
        problems.push(`${key} must be ${allowed.map((a) => `"${a}"`).join(' or ')} in production (got "${env[key] ?? 'unset'}")`);
      }
    }
    if (env['STORAGE_DRIVER'] === 's3' && (!env['STORAGE_S3_BUCKET'] || !env['STORAGE_PUBLIC_BASE_URL'])) {
      problems.push('STORAGE_S3_BUCKET and STORAGE_PUBLIC_BASE_URL are required for the s3 storage driver');
    }
    if (env['EMAIL_DRIVER'] === 'ses' && !env['EMAIL_FROM']) {
      problems.push('EMAIL_FROM is required for the ses email driver');
    }
    if (env['AI_DRIVER'] === 'bedrock' && (!env['BEDROCK_MODEL_REASONING'] || !env['BEDROCK_MODEL_LIGHTWEIGHT'])) {
      problems.push('BEDROCK_MODEL_REASONING and BEDROCK_MODEL_LIGHTWEIGHT are required for the bedrock AI driver');
    }
    if (env['DVLA_DRIVER'] === 'live' && !env['DVLA_API_KEY']) {
      problems.push('DVLA_API_KEY is required for the live DVLA driver');
    }
    if (env['PDF_DRIVER'] === 'puppeteer' && !env['PUPPETEER_EXECUTABLE_PATH']) {
      problems.push('PUPPETEER_EXECUTABLE_PATH is required for the puppeteer PDF driver');
    }
    if (env['SMS_DRIVER'] === 'twilio' && !(env['TWILIO_ACCOUNT_SID'] && env['TWILIO_AUTH_TOKEN'] && env['TWILIO_FROM_NUMBER'])) {
      problems.push('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER are required for the twilio SMS driver');
    }
  }
  return problems;
}

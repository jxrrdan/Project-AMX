import { validateProductionConfig } from './production-config';

const GOOD = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://x',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  CAPTCHA_SECRET: 'c'.repeat(48),
  CORS_ORIGIN: 'https://app.example.co.uk',
  STORAGE_DRIVER: 's3',
  STORAGE_S3_BUCKET: 'bucket',
  STORAGE_PUBLIC_BASE_URL: 'https://files.example.co.uk',
  EMAIL_DRIVER: 'ses',
  EMAIL_FROM: 'no-reply@example.co.uk',
  AI_DRIVER: 'bedrock',
  BEDROCK_MODEL_REASONING: 'm1',
  BEDROCK_MODEL_LIGHTWEIGHT: 'm2',
  CAPTCHA_DRIVER: 'turnstile',
  DVLA_DRIVER: 'live',
  DVLA_API_KEY: 'k',
  PDF_DRIVER: 'puppeteer',
  PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium',
};

describe('validateProductionConfig', () => {
  it('ignores non-production environments', () => {
    expect(validateProductionConfig({ NODE_ENV: 'development' })).toEqual([]);
  });

  it('accepts a complete production configuration', () => {
    expect(validateProductionConfig(GOOD)).toEqual([]);
  });

  it('rejects dev default and short secrets, identical JWT secrets and wildcard CORS', () => {
    const problems = validateProductionConfig({
      ...GOOD,
      JWT_ACCESS_SECRET: 'dev-access-secret-change-me-dev-access-secret',
      JWT_REFRESH_SECRET: 'short',
      CORS_ORIGIN: '*',
    });
    expect(problems.join('\n')).toMatch(/JWT_ACCESS_SECRET is a dev default/);
    expect(problems.join('\n')).toMatch(/JWT_REFRESH_SECRET is a dev default or shorter/);
    expect(problems.join('\n')).toMatch(/CORS_ORIGIN/);
  });

  it('rejects mock drivers unless ALLOW_MOCK_DRIVERS is set for the local stack', () => {
    const mocked = { ...GOOD, STORAGE_DRIVER: 'local', AI_DRIVER: 'mock', CAPTCHA_DRIVER: 'local' };
    expect(validateProductionConfig(mocked).join('\n')).toMatch(/STORAGE_DRIVER must be "s3"/);
    expect(validateProductionConfig({ ...mocked, ALLOW_MOCK_DRIVERS: 'true' })).toEqual([]);
  });

  it('requires driver-specific settings', () => {
    const problems = validateProductionConfig({ ...GOOD, STORAGE_S3_BUCKET: '', DVLA_API_KEY: '', EMAIL_FROM: '' });
    expect(problems.join('\n')).toMatch(/STORAGE_S3_BUCKET/);
    expect(problems.join('\n')).toMatch(/DVLA_API_KEY/);
    expect(problems.join('\n')).toMatch(/EMAIL_FROM/);
  });
});

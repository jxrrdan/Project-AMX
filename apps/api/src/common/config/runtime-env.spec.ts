import { resolveDatabaseUrl } from './runtime-env';

describe('resolveDatabaseUrl', () => {
  it('builds a URL-encoded connection string from discrete parts', () => {
    const env: NodeJS.ProcessEnv = { DB_HOST: 'db.internal', DB_USER: 'ams', DB_PASSWORD: 'p@ss/w:rd', DB_NAME: 'ams' };
    resolveDatabaseUrl(env);
    expect(env['DATABASE_URL']).toBe('postgresql://ams:p%40ss%2Fw%3Ard@db.internal:5432/ams?schema=public&sslmode=require&connection_limit=10');
  });

  it('never overrides an explicit DATABASE_URL', () => {
    const env: NodeJS.ProcessEnv = { DATABASE_URL: 'postgresql://x', DB_HOST: 'db' };
    resolveDatabaseUrl(env);
    expect(env['DATABASE_URL']).toBe('postgresql://x');
  });
});

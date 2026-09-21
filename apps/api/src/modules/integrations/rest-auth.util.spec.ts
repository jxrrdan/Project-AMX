import { IntegrationAuthType } from '@project-amx/shared';
import { buildRequestHeaders, mergeConfigPreservingSecrets, redactConfigSecrets } from './rest-auth.util';

describe('buildRequestHeaders', () => {
  it('returns an empty object with no headers or auth', () => {
    expect(buildRequestHeaders(undefined, undefined)).toEqual({});
  });

  it('includes custom header pairs', () => {
    expect(buildRequestHeaders([{ key: 'X-Custom', value: '1' }], undefined)).toEqual({ 'X-Custom': '1' });
  });

  it('adds a Basic auth header from username/password', () => {
    const headers = buildRequestHeaders(undefined, { type: IntegrationAuthType.BASIC, username: 'alice', password: 'secret' });
    expect(headers['Authorization']).toBe(`Basic ${Buffer.from('alice:secret').toString('base64')}`);
  });

  it('adds a Bearer auth header from a token', () => {
    const headers = buildRequestHeaders(undefined, { type: IntegrationAuthType.BEARER, token: 'abc123' });
    expect(headers['Authorization']).toBe('Bearer abc123');
  });

  it('adds an API key header under the configured name', () => {
    const headers = buildRequestHeaders(undefined, { type: IntegrationAuthType.API_KEY, headerName: 'X-Api-Key', headerValue: 'k1' });
    expect(headers['X-Api-Key']).toBe('k1');
  });

  it('does not add an Authorization header when BASIC has no username', () => {
    const headers = buildRequestHeaders(undefined, { type: IntegrationAuthType.BASIC });
    expect(headers['Authorization']).toBeUndefined();
  });

  it('combines custom headers with auth', () => {
    const headers = buildRequestHeaders(
      [{ key: 'X-Custom', value: '1' }],
      { type: IntegrationAuthType.BEARER, token: 'abc' },
    );
    expect(headers).toEqual({ 'X-Custom': '1', Authorization: 'Bearer abc' });
  });
});

describe('redactConfigSecrets', () => {
  it('masks a top-level password/token field', () => {
    const result = redactConfigSecrets({ url: 'https://x', password: 'hunter2' });
    expect(result.password).toBe('••••••••');
    expect(result.url).toBe('https://x');
  });

  it('masks secrets nested in the auth block without touching non-secret auth fields', () => {
    const result = redactConfigSecrets({ auth: { type: 'BASIC', username: 'alice', password: 'hunter2' } });
    const auth = result.auth as Record<string, unknown>;
    expect(auth.password).toBe('••••••••');
    expect(auth.username).toBe('alice');
  });

  it('masks a header value whose key looks like a credential', () => {
    const result = redactConfigSecrets({ headers: [{ key: 'Authorization', value: 'Bearer abc' }] });
    expect((result.headers as { key: string; value: string }[])[0].value).toBe('••••••••');
  });

  it('leaves an ordinary header untouched', () => {
    const result = redactConfigSecrets({ headers: [{ key: 'X-Request-Id', value: '123' }] });
    expect((result.headers as { key: string; value: string }[])[0].value).toBe('123');
  });

  it('returns an empty object for a missing/non-object config', () => {
    expect(redactConfigSecrets(null)).toEqual({});
    expect(redactConfigSecrets(undefined)).toEqual({});
  });
});

describe('mergeConfigPreservingSecrets', () => {
  it('keeps the existing password when the incoming value is blank', () => {
    const result = mergeConfigPreservingSecrets({ password: 'old-secret' }, { password: '', url: 'https://new' });
    expect(result.password).toBe('old-secret');
    expect(result.url).toBe('https://new');
  });

  it('overwrites the password when a genuinely new value is supplied', () => {
    const result = mergeConfigPreservingSecrets({ password: 'old-secret' }, { password: 'new-secret' });
    expect(result.password).toBe('new-secret');
  });

  it('preserves nested auth secrets the same way', () => {
    const result = mergeConfigPreservingSecrets(
      { auth: { type: 'BASIC', username: 'alice', password: 'old-secret' } },
      { auth: { type: 'BASIC', username: 'alice', password: '' } },
    );
    expect((result.auth as Record<string, unknown>).password).toBe('old-secret');
  });

  it('handles a first-ever save with no prior config', () => {
    const result = mergeConfigPreservingSecrets(undefined, { url: 'https://x', password: 'new' });
    expect(result).toEqual({ url: 'https://x', password: 'new' });
  });

  it('preserves a credential-looking header value when the incoming value is blank', () => {
    const result = mergeConfigPreservingSecrets(
      { headers: [{ key: 'Authorization', value: 'Bearer old-secret' }] },
      { headers: [{ key: 'Authorization', value: '' }] },
    );
    expect((result.headers as { key: string; value: string }[])[0]).toEqual({ key: 'Authorization', value: 'Bearer old-secret' });
  });

  it('overwrites a credential-looking header when a genuinely new value is supplied', () => {
    const result = mergeConfigPreservingSecrets(
      { headers: [{ key: 'Authorization', value: 'Bearer old-secret' }] },
      { headers: [{ key: 'Authorization', value: 'Bearer new-secret' }] },
    );
    expect((result.headers as { key: string; value: string }[])[0].value).toBe('Bearer new-secret');
  });

  it('does not preserve an ordinary (non-credential) header left blank — that is a real edit', () => {
    const result = mergeConfigPreservingSecrets(
      { headers: [{ key: 'X-Request-Id', value: 'old' }] },
      { headers: [{ key: 'X-Request-Id', value: '' }] },
    );
    expect((result.headers as { key: string; value: string }[])[0].value).toBe('');
  });
});

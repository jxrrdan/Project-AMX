import { IntegrationAuthType } from '@project-amx/shared';

export interface HeaderPair {
  key: string;
  value: string;
}

export interface RestAuthConfig {
  type?: IntegrationAuthType | string;
  username?: string;
  password?: string;
  token?: string;
  headerName?: string;
  headerValue?: string;
}

/**
 * Merges a connector's custom headers with its configured authentication into the plain header
 * object axios expects. Credentials never leave the API in a GET response for this connector
 * (see IntegrationsService.getConnector's redaction) — this is the one place they're read back
 * out to actually use them.
 */
export function buildRequestHeaders(headers: HeaderPair[] | undefined, auth: RestAuthConfig | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of headers ?? []) {
    if (pair.key) {
      result[pair.key] = pair.value ?? '';
    }
  }

  switch (auth?.type) {
    case IntegrationAuthType.BASIC:
      if (auth.username) {
        result['Authorization'] = `Basic ${Buffer.from(`${auth.username}:${auth.password ?? ''}`).toString('base64')}`;
      }
      break;
    case IntegrationAuthType.BEARER:
      if (auth.token) {
        result['Authorization'] = `Bearer ${auth.token}`;
      }
      break;
    case IntegrationAuthType.API_KEY:
      if (auth.headerName) {
        result[auth.headerName] = auth.headerValue ?? '';
      }
      break;
    default:
      break;
  }

  return result;
}

/** Fields inside a connector's `config` that hold secrets — redacted before ever being sent to the browser. */
const SECRET_CONFIG_KEYS = ['password', 'token', 'headerValue', 'requiredHeaderValue'] as const;

/**
 * Returns a copy of a connector's config with secret values replaced by a placeholder, so
 * GET /integrations/connectors never round-trips a previously-saved password/token/API key back
 * to the browser. The frontend leaves a field untouched (rather than re-submitting the
 * placeholder) unless the business systems manager actually retypes it — see
 * IntegrationsService.updateConnector for the matching write-side behaviour.
 */
export function redactConfigSecrets(config: unknown): Record<string, unknown> {
  if (!config || typeof config !== 'object') return {};
  const copy: Record<string, unknown> = { ...(config as Record<string, unknown>) };

  for (const key of SECRET_CONFIG_KEYS) {
    if (typeof copy[key] === 'string' && copy[key]) {
      copy[key] = '••••••••';
    }
  }

  if (copy['auth'] && typeof copy['auth'] === 'object') {
    const auth = { ...(copy['auth'] as Record<string, unknown>) };
    for (const key of SECRET_CONFIG_KEYS) {
      if (typeof auth[key] === 'string' && auth[key]) {
        auth[key] = '••••••••';
      }
    }
    copy['auth'] = auth;
  }

  if (Array.isArray(copy['headers'])) {
    copy['headers'] = (copy['headers'] as HeaderPair[]).map((h) =>
      /token|key|secret|password|authorization/i.test(h.key ?? '') && h.value ? { ...h, value: '••••••••' } : h,
    );
  }

  return copy;
}

/**
 * When saving connection settings, an incoming secret field left blank means "leave it as it
 * was" — the frontend never has the real value to send back (see redactConfigSecrets), so a
 * blank submission must not overwrite a previously-saved password/token/API key with nothing.
 */
export function mergeConfigPreservingSecrets(existing: unknown, incoming: Record<string, unknown>): Record<string, unknown> {
  const existingObj = (existing && typeof existing === 'object' ? existing : {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...incoming };

  for (const key of SECRET_CONFIG_KEYS) {
    if (!merged[key]) {
      merged[key] = existingObj[key];
    }
  }

  if (merged['auth'] && typeof merged['auth'] === 'object') {
    const existingAuth = (existingObj['auth'] && typeof existingObj['auth'] === 'object' ? existingObj['auth'] : {}) as Record<
      string,
      unknown
    >;
    const mergedAuth: Record<string, unknown> = { ...(merged['auth'] as Record<string, unknown>) };
    for (const key of SECRET_CONFIG_KEYS) {
      if (!mergedAuth[key]) {
        mergedAuth[key] = existingAuth[key];
      }
    }
    merged['auth'] = mergedAuth;
  }

  // A custom header whose key looks like a credential (e.g. "Authorization") is blanked by the
  // frontend on load, same as the top-level secret fields — an untouched blank submission must
  // not overwrite the previously-saved value with nothing either.
  if (Array.isArray(merged['headers'])) {
    const existingHeaders = Array.isArray(existingObj['headers']) ? (existingObj['headers'] as HeaderPair[]) : [];
    merged['headers'] = (merged['headers'] as HeaderPair[]).map((h) => {
      if (h.value || !/token|key|secret|password|authorization/i.test(h.key ?? '')) {
        return h;
      }
      const existingHeader = existingHeaders.find((eh) => eh.key === h.key);
      return existingHeader ? { ...h, value: existingHeader.value } : h;
    });
  }

  return merged;
}

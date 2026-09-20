import { BadRequestException } from '@nestjs/common';
import { isIP } from 'node:net';

/**
 * Blocks the most common SSRF targets (OWASP A10:2021) for any admin-configured outbound URL this
 * app calls server-side — OEM Integration Hub REST_PULL connectors and Action Triggers alike.
 * Both are configured by a privileged (ModuleKey.ADMIN/OEM_INTEGRATIONS EDIT) dealer-level user,
 * so the primary risk isn't another tenant's data — it's that account pivoting to internal
 * infrastructure (a cloud metadata endpoint, an internal-only service) that the dealer has no
 * legitimate reason to reach.
 *
 * Caveat: this checks the URL's literal hostname/IP at validation time. It does not resolve DNS
 * and re-validate at connection time, so a hostname that resolves to a private address only after
 * this check (DNS rebinding) would slip through — a full fix needs a custom dispatcher that
 * validates the resolved IP on every connection, which is a larger change than this pass covers.
 * This is a real, known gap, not an oversight — flagged in the security review.
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '169.254.169.254', // AWS/GCP/Azure instance metadata
  'metadata.google.internal',
  '[::1]',
]);

export function assertSafeOutboundUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestException('Not a valid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('Only http/https URLs are allowed');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new BadRequestException('This host is not allowed');
  }

  // URL.hostname wraps IPv6 literals in brackets (e.g. "[::1]"), which net.isIP() rejects — strip
  // them before checking, or every IPv6 address would silently skip the private-range check below.
  const bareHost = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  const ipVersion = isIP(bareHost);
  if (ipVersion && isPrivateOrReservedIp(bareHost, ipVersion)) {
    throw new BadRequestException('Private/internal IP addresses are not allowed');
  }
}

function isPrivateOrReservedIp(ip: string, version: number): boolean {
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 127 || // loopback
      a === 10 || // private
      (a === 172 && b >= 16 && b <= 31) || // private
      (a === 192 && b === 168) || // private
      (a === 169 && b === 254) || // link-local / cloud metadata
      a === 0
    );
  }
  // IPv6: loopback (::1) and unique local addresses (fc00::/7) and link-local (fe80::/10).
  const lower = ip.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

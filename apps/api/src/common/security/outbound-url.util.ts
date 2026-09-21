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
  '100.100.100.200', // Alibaba Cloud instance metadata
  '192.0.0.192', // Oracle Cloud instance metadata
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

function isPrivateOrReservedIpv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 127 || // loopback
    a === 10 || // private
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 100 && b >= 64 && b <= 127) || // CGNAT (RFC 6598) — also used by some cloud metadata setups
    a === 0
  );
}

function isPrivateOrReservedIp(ip: string, version: number): boolean {
  if (version === 4) {
    return isPrivateOrReservedIpv4(ip);
  }
  // An IPv4-mapped ("::ffff:a.b.c.d") or IPv4-compatible ("::a.b.c.d") IPv6 literal is delivered by
  // the OS to the embedded IPv4 address on any dual-stack host — check it under the IPv4 rules too,
  // otherwise e.g. "::ffff:169.254.169.254" reaches the cloud metadata endpoint unblocked.
  const mappedIpv4 = extractIPv4MappedAddress(ip);
  if (mappedIpv4 && isPrivateOrReservedIpv4(mappedIpv4)) {
    return true;
  }
  // IPv6: loopback (::1) and unique local addresses (fc00::/7) and link-local (fe80::/10).
  const lower = ip.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

/** Expands "::"-compressed IPv6 shorthand into 8 explicit hex groups, or null if the address is malformed. */
function expandIPv6Groups(ip: string): string[] | null {
  const sides = ip.split('::');
  if (sides.length > 2) return null;
  if (sides.length === 1) {
    const groups = ip.split(':');
    return groups.length === 8 ? groups : null;
  }
  const head = sides[0] ? sides[0].split(':') : [];
  const tail = sides[1] ? sides[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  return [...head, ...Array(missing).fill('0'), ...tail];
}

/** Returns the embedded dotted-decimal IPv4 address of an IPv4-mapped/-compatible IPv6 literal, or null. */
function extractIPv4MappedAddress(ip: string): string | null {
  // Mixed notation with a dotted-quad tail, e.g. "::ffff:127.0.0.1".
  const dottedMatch = /^::(ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (dottedMatch) return dottedMatch[2];

  const groups = expandIPv6Groups(ip);
  if (!groups || groups.length !== 8) return null;
  const isMapped = groups.slice(0, 5).every((g) => g === '0' || g === '') && groups[5].toLowerCase() === 'ffff';
  const isCompatible = groups.slice(0, 6).every((g) => g === '0' || g === '');
  if (!isMapped && !isCompatible) return null;

  const a = parseInt(groups[6], 16);
  const b = parseInt(groups[7], 16);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return [(a >> 8) & 0xff, a & 0xff, (b >> 8) & 0xff, b & 0xff].join('.');
}

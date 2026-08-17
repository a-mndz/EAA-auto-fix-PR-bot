import { isIP } from 'node:net';

/** Result of validating a candidate URL for the public demo scan. */
export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

const BLOCKED_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

function fail(reason: string): UrlCheck {
  return { ok: false, reason };
}

/** Parse an IPv4 address into its four octets, or null when malformed. */
function ipv4Octets(ip: string): [number, number, number, number] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    octets.push(n);
  }
  return [octets[0]!, octets[1]!, octets[2]!, octets[3]!];
}

/** True when the address belongs to loopback, private, link-local, CGNAT, or reserved ranges. */
export function isPrivateIp(ip: string): boolean {
  const lowered = ip.toLowerCase();

  if (isIP(lowered) === 4) {
    const octets = ipv4Octets(lowered);
    if (!octets) return true; // unparseable -> refuse
    const [a, b] = octets;
    if (a === 0) return true; // "this network"
    if (a === 10) return true; // RFC1918
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  if (isIP(lowered) !== 6) return true; // not an IP literal we recognize -> refuse
  if (lowered === '::' || lowered === '::1') return true;

  // IPv4-mapped / IPv4-compatible forms: WHATWG URL normalizes them to hex
  // (::ffff:127.0.0.1 -> ::ffff:7f00:1), so we refuse the whole family —
  // IPv4 addresses should arrive in dotted-quad form.
  if (lowered.startsWith('::ffff:')) return true;
  const embedded = lowered.match(/^(\d+\.\d+\.\d+\.\d+)$/);
  if (embedded) {
    return ipv4Octets(embedded[1]!) ? isPrivateIp(embedded[1]!) : true;
  }

  const firstGroup = lowered.split(':')[0] ?? '';
  const hextet = firstGroup === '' ? 0 : Number.parseInt(firstGroup, 16);
  if (Number.isNaN(hextet)) return true;
  if (hextet >= 0xfe80 && hextet <= 0xfebf) return true; // link-local
  if (hextet >= 0xfc00 && hextet <= 0xfdff) return true; // unique local
  if (hextet >= 0xff00) return true; // multicast
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, '');
  if (lower === 'localhost') return true;
  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

/**
 * Validate a user-supplied URL before the demo scanner touches it.
 * Accepts http/https only, refuses internal hostnames, IP literals in
 * private ranges, and auto-prefixes https:// when no scheme is given.
 * Does NOT perform DNS resolution; pair with a DNS check before fetching.
 */
export function isScanSafeUrl(raw: unknown): UrlCheck {
  if (typeof raw !== 'string') return fail('url required');
  let candidate = raw.trim();
  if (candidate.length === 0) return fail('url required');
  if (candidate.length > 2048) return fail('url too long');

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = candidate.startsWith('//') ? `https:${candidate}` : `https://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return fail('not a valid url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return fail(`protocol ${url.protocol.replace(':', '')} not allowed`);
  }

  const host = url.hostname;
  if (!host) return fail('missing hostname');
  if (isBlockedHostname(host)) return fail('host not allowed');
  // URL.hostname wraps IPv6 literals in brackets; strip them for range checks.
  const bareHost = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (isIP(bareHost) !== 0 && isPrivateIp(bareHost)) return fail('host not allowed');

  return { ok: true, url };
}
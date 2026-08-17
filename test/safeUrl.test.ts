import { describe, it, expect } from 'vitest';
import { isScanSafeUrl, isPrivateIp } from '../src/demo/safeUrl.js';

function check(raw: unknown): { ok: boolean; href?: string; reason?: string } {
  const res = isScanSafeUrl(raw);
  return res.ok ? { ok: true, href: res.url.href } : { ok: false, reason: res.reason };
}

describe('isScanSafeUrl', () => {
  it('accepts a plain https URL', () => {
    expect(check('https://example.com')).toEqual({ ok: true, href: 'https://example.com/' });
  });

  it('accepts an http URL and keeps query params', () => {
    const res = check('http://example.com/shop?page=1');
    expect(res.ok).toBe(true);
    expect(res.href).toBe('http://example.com/shop?page=1');
  });

  it('prefixes https:// when the scheme is missing', () => {
    expect(check('example.com')).toEqual({ ok: true, href: 'https://example.com/' });
  });

  it('prefixes https: for protocol-relative URLs', () => {
    expect(check('//example.com/')).toEqual({ ok: true, href: 'https://example.com/' });
  });

  it('rejects non-string input', () => {
    expect(check(undefined).ok).toBe(false);
    expect(check(null).ok).toBe(false);
    expect(check(42).ok).toBe(false);
  });

  it('rejects empty and oversized input', () => {
    expect(check('').ok).toBe(false);
    expect(check('   ').ok).toBe(false);
    expect(check(`https://example.com/${'x'.repeat(2100)}`).ok).toBe(false);
  });

  it('rejects non-http(s) protocols', () => {
    expect(check('ftp://example.com').ok).toBe(false);
    expect(check('file:///etc/passwd').ok).toBe(false);
    expect(check('javascript:alert(1)').ok).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(check('https://').ok).toBe(false);
    expect(check('not a url at all').ok).toBe(false);
  });

  it('rejects localhost variants and private suffixes', () => {
    expect(check('http://localhost:3000').ok).toBe(false);
    expect(check('http://foo.localhost').ok).toBe(false);
    expect(check('http://db.local').ok).toBe(false);
    expect(check('http://api.internal').ok).toBe(false);
  });

  it('rejects IPv4 literals in private ranges', () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.5',
      '172.16.9.9',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
    ]) {
      expect(check(`http://${ip}`).ok).toBe(false);
    }
  });

  it('rejects IPv6 loopback and unique-local literals', () => {
    expect(check('https://[::1]').ok).toBe(false);
    expect(check('https://[fd00::1]').ok).toBe(false);
    expect(check('https://[fe80::1]').ok).toBe(false);
  });

  it('accepts public IPv4 and IPv6 literals', () => {
    expect(check('https://93.184.216.34').ok).toBe(true);
    expect(check('https://[2606:2800:220:1:248:1893:25c8:1946]').ok).toBe(true);
  });

  it('rejects IPv4-mapped private IPv6 forms', () => {
    expect(check('http://[::ffff:127.0.0.1]').ok).toBe(false);
  });
});

describe('isPrivateIp', () => {
  it('classifies common ranges', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('169.254.169.254')).toBe(true);
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('2606:4700::1')).toBe(false);
    expect(isPrivateIp('not-an-ip')).toBe(true); // unknown -> refuse
  });
});
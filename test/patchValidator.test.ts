import { describe, expect, it } from 'vitest';
import { validatePatches, rejectUnsafeContent } from '../src/fixer/patchValidator.js';

describe('validatePatches', () => {
  const scopes = [
    { path: 'index.html', ruleIds: ['html-has-lang'] },
    { path: 'about.html', ruleIds: ['image-alt', 'link-name'] },
  ];

  it('accepts patches limited to files with detected violations', () => {
    const result = validatePatches(
      [{ path: 'index.html', content: '<html lang="en"></html>' }],
      scopes,
    );
    expect(result.valid).toBe(true);
    expect(result.allowedRuleIds).toContain('html-has-lang');
  });

  it('rejects patches targeting files with no detected violation (drive-by edit)', () => {
    const result = validatePatches(
      [{ path: 'README.md', content: '# hacked' }],
      scopes,
    );
    expect(result.valid).toBe(false);
    expect(result.violations.join(' ')).toContain('no detected violation');
  });

  it('rejects patches to off-limits paths', () => {
    const result = validatePatches(
      [{ path: '.github/workflows/ci.yml', content: 'jobs: {}' }],
      [{ path: '.github/workflows/ci.yml', ruleIds: ['html-has-lang'] }],
    );
    expect(result.valid).toBe(false);
    expect(result.violations.join(' ')).toContain('off-limits');
  });

  it('rejects lockfile patches even when scoped', () => {
    const result = validatePatches(
      [{ path: 'package-lock.json', content: '{}' }],
      [{ path: 'package-lock.json', ruleIds: ['image-alt'] }],
    );
    expect(result.valid).toBe(false);
  });

  it('rejects oversized patches', () => {
    const big = 'x'.repeat(33_000);
    const result = validatePatches([{ path: 'index.html', content: big }], scopes);
    expect(result.valid).toBe(false);
    expect(result.violations.join(' ')).toContain('exceeds');
  });

  it('rejects empty patch sets', () => {
    const result = validatePatches([], scopes);
    expect(result.valid).toBe(false);
  });

  it('rejects too many files', () => {
    const many = Array.from({ length: 13 }, (_, i) => ({
      path: 'index.html',
      content: `v${i}`,
    }));
    const result = validatePatches(many, scopes);
    expect(result.valid).toBe(false);
    expect(result.violations.join(' ')).toContain('max');
  });
});

describe('rejectUnsafeContent', () => {
  it('flags script injection', () => {
    expect(rejectUnsafeContent('<script src=x>')).not.toBeNull();
  });

  it('flags inline event handlers', () => {
    expect(rejectUnsafeContent('<button onclick="steal()">x</button>')).not.toBeNull();
  });

  it('flags javascript: URIs', () => {
    expect(rejectUnsafeContent('<a href="javascript:void(0)">x</a>')).not.toBeNull();
  });

  it('passes clean HTML', () => {
    expect(rejectUnsafeContent('<html lang="en"><body></body></html>')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { applyDeterministicFixes, hasDeterministicHandler } from '../src/fixer/deterministic.js';

describe('deterministic fixes', () => {
  it('adds lang="en" to <html> when missing (html-has-lang)', () => {
    const { source, outcomes } = applyDeterministicFixes('<html><head></head></html>', [
      'html-has-lang',
    ]);
    expect(source).toBe('<html lang="en"><head></head></html>');
    expect(outcomes[0]?.applied).toBe(true);
  });

  it('does not overwrite an existing lang attribute', () => {
    const { source, outcomes } = applyDeterministicFixes('<html lang="de"><body></body></html>', [
      'html-has-lang',
    ]);
    expect(source).toContain('lang="de"');
    expect(outcomes[0]?.applied).toBe(false);
  });

  it('replaces empty lang with a valid value (html-lang-valid)', () => {
    const { source, outcomes } = applyDeterministicFixes(`<html lang=""><body></body></html>`, [
      'html-lang-valid',
    ]);
    expect(source).toBe('<html lang="en"><body></body></html>');
    expect(outcomes[0]?.applied).toBe(true);
  });

  it('re-enables zoom on restrictive viewport meta', () => {
    const input =
      '<head><meta name="viewport" content="width=device-width, user-scalable=no, maximum-scale=1.0"></head>';
    const { source, outcomes } = applyDeterministicFixes(input, ['meta-viewport']);
    expect(source).toContain('user-scalable=yes');
    expect(source).toContain('maximum-scale=5');
    expect(source).not.toContain('user-scalable=no');
    expect(outcomes[0]?.applied).toBe(true);
  });

  it('leaves permissive viewport untouched', () => {
    const input = '<head><meta name="viewport" content="width=device-width"></head>';
    const { outcomes } = applyDeterministicFixes(input, ['meta-viewport']);
    expect(outcomes[0]?.applied).toBe(false);
  });

  it('adds alt="" only to decorative images', () => {
    const input = `
      <img src="/spacer.png" aria-hidden="true">
      <img src="/photo.jpg">
    `;
    const { source, outcomes } = applyDeterministicFixes(input, ['image-alt']);
    expect(source).toContain('aria-hidden="true" alt=""');
    expect(source).toContain('<img src="/photo.jpg">');
    expect(outcomes[0]?.applied).toBe(true);
  });

  it('chains multiple rules across one source', () => {
    const input = '<html><head><meta name="viewport" content="user-scalable=no"></head></html>';
    const { source, outcomes } = applyDeterministicFixes(input, ['html-has-lang', 'meta-viewport']);
    expect(source).toContain('lang="en"');
    expect(source).toContain('user-scalable=yes');
    expect(outcomes.every((o) => o.applied)).toBe(true);
  });

  it('reports no handler for unknown rules', () => {
    const { outcomes } = applyDeterministicFixes('<html></html>', ['link-name']);
    expect(outcomes[0]?.applied).toBe(false);
    expect(outcomes[0]?.reason).toContain('no deterministic handler');
  });

  it('exposes handler presence for tier routing', () => {
    expect(hasDeterministicHandler('html-has-lang')).toBe(true);
    expect(hasDeterministicHandler('link-name')).toBe(false);
  });
});

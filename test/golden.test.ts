/**
 * Golden-case eval (release gate per RULES.md): fixture pages with known
 * violations -> deterministic fix -> patch validation -> in-scope assertion.
 * Run against Tier-0 rules; LLM-tier golden cases require a fixture server.
 */
import { describe, expect, it } from 'vitest';
import { applyDeterministicFixes } from '../src/fixer/deterministic.js';
import { validatePatches } from '../src/fixer/patchValidator.js';

interface GoldenCase {
  name: string;
  path: string;
  ruleIds: string[];
  before: string;
  expectContains: string[];
  expectNotContains: string[];
}

const GOLDEN_CASES: GoldenCase[] = [
  {
    name: 'missing html lang',
    path: 'index.html',
    ruleIds: ['html-has-lang'],
    before: `<!DOCTYPE html>\n<html>\n<head><title>Shop</title></head>\n<body></body>\n</html>`,
    expectContains: ['<html lang="en">'],
    expectNotContains: [],
  },
  {
    name: 'zoom blocked by viewport meta',
    path: 'layout.html',
    ruleIds: ['meta-viewport'],
    before: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"></head><body></body></html>`,
    expectContains: ['user-scalable=yes', 'maximum-scale=5', 'width=device-width'],
    expectNotContains: ['user-scalable=no'],
  },
  {
    name: 'decorative spacer image without alt',
    path: 'hero.html',
    ruleIds: ['image-alt'],
    before: `<html><body><img src="/assets/spacer.gif" aria-hidden="true"><h1>Hero</h1></body></html>`,
    expectContains: ['alt=""', 'aria-hidden="true"'],
    expectNotContains: [],
  },
];

describe('golden cases: deterministic tier', () => {
  for (const gc of GOLDEN_CASES) {
    it(`${gc.name} -> in-scope fix only`, () => {
      const { source, outcomes } = applyDeterministicFixes(gc.before, gc.ruleIds);

      const handled = outcomes.filter((o) => o.applied);
      expect(handled.length, `expected fix to apply for ${gc.ruleIds.join(',')}`).toBeGreaterThan(0);
      expect(new Set(handled.map((o) => o.ruleId))).toEqual(new Set(gc.ruleIds));

      for (const s of gc.expectContains) expect(source).toContain(s);
      for (const s of gc.expectNotContains) expect(source).not.toContain(s);

      const patches = [{ path: gc.path, content: source }];
      const scopes = [{ path: gc.path, ruleIds: gc.ruleIds }];
      const validation = validatePatches(patches, scopes);
      expect(validation.valid, validation.violations.join('; ')).toBe(true);

      expect(validation.allowedRuleIds).toEqual(expect.arrayContaining(gc.ruleIds));
    });
  }

  it('every diff target maps to a detected rule id (scope guard)', () => {
    const { source } = applyDeterministicFixes(
      '<html><body><p>x</p></body></html>',
      ['html-has-lang'],
    );
    const validation = validatePatches(
      [{ path: 'untouched.html', content: source }],
      [{ path: 'index.html', ruleIds: ['html-has-lang'] }],
    );
    expect(validation.valid).toBe(false);
  });
});

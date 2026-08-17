import { describe, expect, it } from 'vitest';
import { renderPrBody, branchName, type PrPayload } from '../src/prbot.js';

function payload(overrides: Partial<PrPayload> = {}): PrPayload {
  return {
    owner: 'acme',
    repo: 'site',
    baseBranch: 'main',
    branch: 'eaa-fix/html-has-lang',
    ruleIds: ['html-has-lang'],
    patches: [{ path: 'index.html', content: '<html lang="en"></html>' }],
    beforeScan: [
      { url: 'https://acme.example/', title: 'Home', violationCount: 7, violations: [] },
    ],
    afterScan: [
      { url: 'https://acme.example/', title: 'Home', violationCount: 5, violations: [] },
    ],
    notes: ['[deterministic] html-has-lang: added lang="en" to <html>'],
    source: 'deterministic',
    llmCostUsd: 0,
    ...overrides,
  };
}

describe('branchName', () => {
  it('builds eaa-fix branch from rule ids', () => {
    expect(branchName(['html-has-lang', 'image-alt'])).toBe('eaa-fix/html-has-lang-image-alt');
  });
  it('falls back to generic slug for empty rules', () => {
    expect(branchName([])).toBe('eaa-fix/a11y');
  });
  it('truncates long rule lists', () => {
    expect(branchName(['a'.repeat(60)])).toMatch(/^eaa-fix\//);
    expect(branchName(['a'.repeat(60)]).length).toBeLessThanOrEqual('eaa-fix/'.length + 48);
  });
});

describe('renderPrBody', () => {
  it('states the bot cannot merge', () => {
    const body = renderPrBody(payload());
    expect(body).toContain('no merge permission');
    expect(body).toContain('bot cannot merge');
  });

  it('lists scoped rule ids', () => {
    const body = renderPrBody(payload());
    expect(body).toContain('axe rule: `html-has-lang`');
  });

  it('reports before/after counts and regression warning on increase', () => {
    const regressed = payload({
      afterScan: [{ url: 'https://acme.example/', title: 'Home', violationCount: 9, violations: [] }],
    });
    const body = renderPrBody(regressed);
    expect(body).toContain('+2');
    expect(body).toContain('regression — do not merge');
  });

  it('shows pending after-scan when not yet run', () => {
    const body = renderPrBody(payload({ afterScan: [] }));
    expect(body).toContain('pending');
    expect(body).toContain('gates merge');
  });

  it('includes per-fix LLM cost when set', () => {
    const body = renderPrBody(payload({ llmCostUsd: 0.0123, model: 'claude-sonnet-4-5' }));
    expect(body).toContain('$0.0123');
  });
});

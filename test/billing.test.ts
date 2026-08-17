import { describe, expect, it } from 'vitest';
import {
  computeBillable,
  DEFAULT_PLAN,
  freeTierAllowsFixes,
  llmCostRatio,
  withinMarginCap,
  type PlanConfig,
} from '../src/billing/usage.js';

describe('computeBillable', () => {
  it('meters fixes and pages above quota, adds base price', () => {
    const bill = computeBillable({ mergedFixes: 3, pagesScanned: 250, llmSpendUsd: 0 });
    expect(bill.fixesMetered).toBe(3);
    expect(bill.pagesMetered).toBe(50); // 250 - 200 quota
    expect(bill.fixesCostUsd).toBe(12); // 3 * 4
    expect(bill.pagesCostUsd).toBe(5); // 50 * 0.1
    expect(bill.meteredUsd).toBe(17);
    expect(bill.totalUsd).toBe(39 + 17);
  });

  it('never meters negative pages when under quota', () => {
    const bill = computeBillable({ mergedFixes: 0, pagesScanned: 50, llmSpendUsd: 0 });
    expect(bill.pagesMetered).toBe(0);
    expect(bill.pagesCostUsd).toBe(0);
    expect(bill.meteredUsd).toBe(0);
    expect(bill.totalUsd).toBe(DEFAULT_PLAN.basePriceUsd);
  });

  it('honours a custom plan config', () => {
    const plan: PlanConfig = { ...DEFAULT_PLAN, monthlyPageQuota: 0, basePriceUsd: 79, pricePerPageUsd: 0.2 };
    const bill = computeBillable({ mergedFixes: 0, pagesScanned: 10, llmSpendUsd: 0 }, plan);
    expect(bill.pagesMetered).toBe(10);
    expect(bill.pagesCostUsd).toBe(2);
    expect(bill.totalUsd).toBe(81);
  });
});

describe('free tier', () => {
  it('never allows fixes on the free tier', () => {
    expect(freeTierAllowsFixes()).toBe(false);
  });
});

describe('margin guard (ADR 003)', () => {
  it('returns Infinity ratio when revenue is zero', () => {
    expect(llmCostRatio(5, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('computes the LLM-spend fraction of revenue', () => {
    expect(llmCostRatio(2, 100)).toBeCloseTo(0.02);
  });

  it('passes when LLM spend is within 20% of revenue', () => {
    const usage = { mergedFixes: 5, pagesScanned: 300, llmSpendUsd: 10 };
    expect(withinMarginCap(usage)).toBe(true);
  });

  it('fails when LLM spend exceeds 20% of revenue', () => {
    const usage = { mergedFixes: 1, pagesScanned: 0, llmSpendUsd: 50 };
    expect(withinMarginCap(usage)).toBe(false);
  });
});

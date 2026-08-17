/**
 * Pure billing math: turns a repo's monthly usage into billable quantities and
 * a revenue/margin preview. No I/O — fully unit-tested. Stripe meters receive
 * the raw metered events; this module projects cost for dashboards/invoices and
 * enforces the LLM-cost <= 20% of revenue margin guard (ADR 003).
 */

export interface MonthlyUsage {
  mergedFixes: number;
  pagesScanned: number;
  /** LLM spend accrued this billing period, in USD. */
  llmSpendUsd: number;
}

export interface PlanConfig {
  /** Pages included in the base subscription before metering. */
  monthlyPageQuota: number;
  pricePerMergedFixUsd: number;
  pricePerPageUsd: number;
  /** Base subscription price (USD/mo), billed separately by Stripe. */
  basePriceUsd: number;
  /** Max fraction of revenue LLM spend may consume (ADR 003). */
  maxLlmCostRatio: number;
}

export const DEFAULT_PLAN: PlanConfig = {
  monthlyPageQuota: 200,
  pricePerMergedFixUsd: 4,
  pricePerPageUsd: 0.1,
  basePriceUsd: 39,
  maxLlmCostRatio: 0.2,
};

export interface BillableBreakdown {
  pagesMetered: number;
  fixesMetered: number;
  pagesCostUsd: number;
  fixesCostUsd: number;
  meteredUsd: number;
  basePriceUsd: number;
  totalUsd: number;
}

/** Project a month's usage into billable line items under the given plan. */
export function computeBillable(usage: MonthlyUsage, plan: PlanConfig = DEFAULT_PLAN): BillableBreakdown {
  const pagesMetered = Math.max(0, usage.pagesScanned - plan.monthlyPageQuota);
  const fixesMetered = Math.max(0, usage.mergedFixes);
  const pagesCostUsd = round2(pagesMetered * plan.pricePerPageUsd);
  const fixesCostUsd = round2(fixesMetered * plan.pricePerMergedFixUsd);
  const meteredUsd = round2(pagesCostUsd + fixesCostUsd);
  const totalUsd = round2(plan.basePriceUsd + meteredUsd);
  return {
    pagesMetered,
    fixesMetered,
    pagesCostUsd,
    fixesCostUsd,
    meteredUsd,
    basePriceUsd: plan.basePriceUsd,
    totalUsd,
  };
}

/**
 * Free tier = 1 repo, scan-only, no fixes. A repo on the free tier may not
 * generate fixes at all; this gate keeps the pipeline from billing for fixes
 * the plan doesn't include.
 */
export function freeTierAllowsFixes(): false {
  return false;
}

/** LLM spend as a fraction of revenue. Returns Infinity when revenue is 0. */
export function llmCostRatio(llmSpendUsd: number, revenueUsd: number): number {
  if (revenueUsd <= 0) return Number.POSITIVE_INFINITY;
  return llmSpendUsd / revenueUsd;
}

/** True when LLM spend stays within the margin cap (ADR 003: <= 20%). */
export function withinMarginCap(usage: MonthlyUsage, plan: PlanConfig = DEFAULT_PLAN): boolean {
  const bill = computeBillable(usage, plan);
  return llmCostRatio(usage.llmSpendUsd, bill.totalUsd) <= plan.maxLlmCostRatio;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

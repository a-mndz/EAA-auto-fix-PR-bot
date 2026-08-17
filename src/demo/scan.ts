import { isIP } from 'node:net';
import { lookup, resolve4, resolve6 } from 'node:dns/promises';
import { chromium, type Browser } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import type { Result } from 'axe-core';
import { isScanSafeUrl, isPrivateIp } from './safeUrl.js';

export const DEMO_TIMEOUT_MS = 30_000;
export const MAX_REPORTED_VIOLATIONS = 12;

export interface DemoViolation {
  ruleId: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  target: string;
  help: string;
  helpUrl: string;
  wcagRefs: string[];
  nodes: number;
}

export interface DemoScanOutcome {
  url: string;
  title: string;
  violationCount: number;
  violations: DemoViolation[];
}

const IMPACT_RANK: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };

function impactRank(impact: DemoViolation['impact']): number {
  return impact ? (IMPACT_RANK[impact] ?? 9) : 9;
}

function flattenTarget(target: unknown): string {
  if (Array.isArray(target)) return target.map(flattenTarget).join(' ');
  return String(target);
}

function toDemoViolation(result: Result): DemoViolation {
  return {
    ruleId: result.id,
    impact: (result.impact as DemoViolation['impact']) ?? null,
    target: flattenTarget(result.nodes[0]?.target ?? result.id),
    help: result.help ?? result.description ?? result.id,
    helpUrl: result.helpUrl ?? '',
    wcagRefs: (result.tags ?? []).filter((t) => t.startsWith('wcag')),
    nodes: result.nodes.length,
  };
}

/**
 * Refuse to scan when the hostname resolves to an internal address.
 * Note: Chromium resolves DNS again at fetch time, so a hostile DNS
 * rebinding between this check and the fetch remains theoretically
 * possible; accepted at demo tier (see ADR 006).
 */
async function resolveAndGate(hostname: string): Promise<void> {
  if (isIP(hostname) !== 0) {
    if (isPrivateIp(hostname)) throw new Error('host not allowed');
    return;
  }
  let addresses: string[] = [];
  const settled = await Promise.allSettled([resolve4(hostname), resolve6(hostname)]);
  for (const s of settled) {
    if (s.status === 'fulfilled') addresses.push(...s.value);
  }
  if (addresses.length === 0) {
    const looked = await lookup(hostname, { all: true }).catch(() => [] as { address: string }[]);
    addresses = looked.map((l) => l.address);
  }
  if (addresses.length === 0) throw new Error('hostname did not resolve');
  for (const address of addresses) {
    if (isPrivateIp(address)) throw new Error('host not allowed');
  }
}

/**
 * Scan exactly one public URL with the production axe-core pipeline and
 * return a compact violation list for the landing page. Throws for
 * refused URLs and navigation failures; callers map errors onto the
 * user-facing response.
 */
export async function demoScan(rawUrl: unknown): Promise<DemoScanOutcome> {
  const check = isScanSafeUrl(rawUrl);
  if (!check.ok) throw Object.assign(new Error(check.reason), { statusCode: 400 });

  const url = check.url.href;
  await resolveAndGate(check.url.hostname);

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: DEMO_TIMEOUT_MS });
      const title = await page.title();
      const raw = await new AxeBuilder({ page }).analyze();
      const all = (raw.violations ?? []).map(toDemoViolation);
      const violations = all
        .sort((a, b) => impactRank(a.impact) - impactRank(b.impact))
        .slice(0, MAX_REPORTED_VIOLATIONS);
      return { url, title, violationCount: all.length, violations };
    } finally {
      await context.close();
    }
  } finally {
    await browser?.close();
  }
}
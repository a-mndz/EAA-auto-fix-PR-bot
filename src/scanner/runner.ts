import { chromium, type Browser } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import type { Result } from 'axe-core';
import type { AxeViolation, ScanResult, ScanResultWithScreenshots } from '../types.js';

export interface ScanOptions {
  maxPages: number;
  timeoutMs: number;
  captureScreenshots?: boolean;
}

export interface ScreenshotData {
  url: string;
  path: string;
  base64: string;
  timestamp: Date;
}

function flattenTarget(target: unknown): string {
  if (Array.isArray(target)) return target.map(flattenTarget).join(' ');
  return String(target);
}

function mapViolation(pageUrl: string, result: Result): AxeViolation[] {
  return result.nodes.map((node) => ({
    ruleId: result.id,
    impact: (result.impact as AxeViolation['impact']) ?? null,
    pageUrl,
    target: flattenTarget(node.target),
    html: typeof node.html === 'string' ? node.html.slice(0, 400) : '',
    helpUrl: result.helpUrl ?? '',
    wcagRefs: (result.tags ?? []).filter((t) => t.startsWith('wcag') || t.startsWith('best-practice')),
    description: result.description ?? '',
  }));
}

/** Run an axe-core scan against a set of URLs with a single shared browser. */
export async function scanPages(urls: string[], opts: ScanOptions): Promise<ScanResultWithScreenshots> {
  const results: ScanResult[] = [];
  const screenshots: ScreenshotData[] = [];
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const limited = urls.slice(0, opts.maxPages);

    for (const url of limited) {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: opts.timeoutMs });
        await page.waitForLoadState('domcontentloaded');
        
        if (opts.captureScreenshots) {
          const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
          screenshots.push({
            url,
            path: url.replace(/[^a-z0-9]/gi, '_'),
            base64: screenshot.toString('base64'),
            timestamp: new Date(),
          });
        }
        
        const axe = new AxeBuilder({ page });
        const raw = await axe.analyze();
        const violations = (raw.violations ?? []).flatMap((v) => mapViolation(url, v));
        results.push({
          url,
          title: await page.title(),
          violationCount: violations.length,
          violations,
          screenshots: opts.captureScreenshots ? screenshots.filter(s => s.url === url) : undefined,
        });
      } catch (err) {
        results.push({
          url,
          title: '',
          violationCount: 0,
          violations: [],
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser?.close();
  }
  return { results, screenshots };
}

export async function captureScreenshots(urls: string[], opts: ScanOptions): Promise<ScreenshotData[]> {
  const screenshots: ScreenshotData[] = [];
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const limited = urls.slice(0, opts.maxPages);

    for (const url of limited) {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: opts.timeoutMs });
        await page.waitForLoadState('domcontentloaded');
        const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
        screenshots.push({
          url,
          path: url.replace(/[^a-z0-9]/gi, '_'),
          base64: screenshot.toString('base64'),
          timestamp: new Date(),
        });
      } catch (err) {
        console.warn(`[screenshot] failed for ${url}:`, err);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser?.close();
  }
  return screenshots;
}

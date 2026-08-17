import { describe, it, expect } from 'vitest';
import { compareScreenshots, renderDiffComment } from '../src/scanner/visualDiff.js';
import type { ScreenshotData } from '../src/types.js';

function makeScreenshot(overrides: Partial<ScreenshotData> = {}): ScreenshotData {
  const base64 = Buffer.from('test').toString('base64');
  return {
    url: 'https://example.com',
    path: 'https___example_com',
    base64,
    timestamp: new Date(),
    ...overrides,
  };
}

describe('visualDiff', () => {
  describe('compareScreenshots', () => {
    it('returns empty array when no matching paths', async () => {
      const baseline = [makeScreenshot({ path: 'a' })];
      const current = [makeScreenshot({ path: 'b' })];
      const diffs = await compareScreenshots(baseline, current);
      expect(diffs).toHaveLength(0);
    });

    it('compares matching screenshots by path', async () => {
      const baseline = [makeScreenshot({ path: 'a' })];
      const current = [makeScreenshot({ path: 'a' })];
      const diffs = await compareScreenshots(baseline, current);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].path).toBe('a');
      expect(diffs[0].diffPercentage).toBe(0);
      expect(diffs[0].hasSignificantDiff).toBe(false);
    });

    it('detects significant diff when percentage exceeds threshold', async () => {
      const baseBuf = Buffer.alloc(100 * 4);
      for (let i = 0; i < baseBuf.length; i += 4) {
        baseBuf[i] = 255;
        baseBuf[i + 1] = 255;
        baseBuf[i + 2] = 255;
        baseBuf[i + 3] = 255;
      }

      const curBuf = Buffer.alloc(100 * 4);
      for (let i = 0; i < curBuf.length; i += 4) {
        curBuf[i] = 0;
        curBuf[i + 1] = 0;
        curBuf[i + 2] = 0;
        curBuf[i + 3] = 255;
      }

      const baseline = [makeScreenshot({ base64: baseBuf.toString('base64') })];
      const current = [makeScreenshot({ base64: curBuf.toString('base64') })];

      const diffs = await compareScreenshots(baseline, current);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].diffPercentage).toBeGreaterThan(0.5);
      expect(diffs[0].hasSignificantDiff).toBe(true);
    });
  });

  describe('renderDiffComment', () => {
    it('returns no-regression message for empty diffs', () => {
      const comment = renderDiffComment([]);
      expect(comment).toBe('No visual regressions detected.');
    });

    it('shows significant changes', () => {
      const diffs = [
        {
          url: 'https://example.com',
          path: 'a',
          baselineBase64: 'abc',
          currentBase64: 'def',
          diffBase64: 'ghi',
          pixelDiff: 100,
          diffPercentage: 1.0,
          hasSignificantDiff: true,
        },
      ];
      const comment = renderDiffComment(diffs);
      expect(comment).toContain('⚠️ **1 significant visual change(s) detected**');
      expect(comment).toContain('Significant Changes');
      expect(comment).toContain('example.com');
    });

    it('shows minor changes below threshold', () => {
      const diffs = [
        {
          url: 'https://example.com',
          path: 'a',
          baselineBase64: 'abc',
          currentBase64: 'def',
          diffBase64: 'ghi',
          pixelDiff: 1,
          diffPercentage: 0.1,
          hasSignificantDiff: false,
        },
      ];
      const comment = renderDiffComment(diffs);
      expect(comment).toContain('✅ No significant visual regressions detected');
      expect(comment).toContain('Minor Changes (below threshold)');
    });
  });
});
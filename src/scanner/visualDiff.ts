import type { ScreenshotData } from '../types.js';

export interface VisualDiffResult {
  url: string;
  path: string;
  baselineBase64: string;
  currentBase64: string;
  diffBase64: string;
  pixelDiff: number;
  diffPercentage: number;
  hasSignificantDiff: boolean;
}

const THRESHOLD_PERCENTAGE = 0.5;

function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

function comparePixels(
  baseline: Buffer,
  current: Buffer,
  _width: number,
  _height: number
): { diffBuffer: Buffer; diffCount: number } {
  const diffBuffer = Buffer.alloc(baseline.length);
  let diffCount = 0;

  for (let i = 0; i < baseline.length; i += 4) {
    const r1 = baseline[i] ?? 0;
    const g1 = baseline[i + 1] ?? 0;
    const b1 = baseline[i + 2] ?? 0;
    const a1 = baseline[i + 3] ?? 0;

    const r2 = current[i] ?? 0;
    const g2 = current[i + 1] ?? 0;
    const b2 = current[i + 2] ?? 0;
    const a2 = current[i + 3] ?? 0;

    const dr = Math.abs(r1 - r2);
    const dg = Math.abs(g1 - g2);
    const db = Math.abs(b1 - b2);
    const da = Math.abs(a1 - a2);

    const isDiff = dr > 10 || dg > 10 || db > 10 || da > 10;

    if (isDiff) {
      diffCount++;
      diffBuffer[i] = 255;
      diffBuffer[i + 1] = 0;
      diffBuffer[i + 2] = 0;
      diffBuffer[i + 3] = 255;
    } else {
      diffBuffer[i] = baseline[i] ?? 0;
      diffBuffer[i + 1] = baseline[i + 1] ?? 0;
      diffBuffer[i + 2] = baseline[i + 2] ?? 0;
      diffBuffer[i + 3] = baseline[i + 3] ?? 0;
    }
  }

  return { diffBuffer, diffCount };
}

export async function compareScreenshots(
  baseline: ScreenshotData[],
  current: ScreenshotData[]
): Promise<VisualDiffResult[]> {
  const results: VisualDiffResult[] = [];

  const baselineMap = new Map(baseline.map((s) => [s.path, s]));
  const currentMap = new Map(current.map((s) => [s.path, s]));

  for (const [path, baseShot] of baselineMap) {
    const curShot = currentMap.get(path);
    if (!curShot) continue;

    const baseBuf = base64ToBuffer(baseShot.base64);
    const curBuf = base64ToBuffer(curShot.base64);

    const minLen = Math.min(baseBuf.length, curBuf.length);
    const width = Math.floor(Math.sqrt(minLen / 4));
    const height = width;

    const { diffBuffer, diffCount } = comparePixels(
      baseBuf.subarray(0, minLen),
      curBuf.subarray(0, minLen),
      width,
      height
    );

    const totalPixels = minLen / 4;
    const diffPercentage = (diffCount / totalPixels) * 100;

    results.push({
      url: baseShot.url,
      path: baseShot.path,
      baselineBase64: baseShot.base64,
      currentBase64: curShot.base64,
      diffBase64: diffBuffer.toString('base64'),
      pixelDiff: diffCount,
      diffPercentage: Math.round(diffPercentage * 100) / 100,
      hasSignificantDiff: diffPercentage > THRESHOLD_PERCENTAGE,
    });
  }

  return results;
}

export function renderDiffComment(diffs: VisualDiffResult[]): string {
  if (diffs.length === 0) {
    return 'No visual regressions detected.';
  }

  const significant = diffs.filter((d) => d.hasSignificantDiff);
  const minor = diffs.filter((d) => !d.hasSignificantDiff);

  const lines: string[] = [
    '## Visual Regression Check',
    '',
    significant.length > 0
      ? `⚠️ **${significant.length} significant visual change(s) detected**`
      : '✅ No significant visual regressions detected',
    '',
  ];

  if (significant.length > 0) {
    lines.push('### Significant Changes');
    lines.push('');
    lines.push('| Page | Diff % | Baseline | Current | Diff |');
    lines.push('| --- | ---: | --- | --- | --- |');

    for (const d of significant) {
      lines.push(
        `| ${d.url} | ${d.diffPercentage}% | ![baseline](data:image/png;base64,${d.baselineBase64.slice(0, 50)}...) | ![current](data:image/png;base64,${d.currentBase64.slice(0, 50)}...) | ![diff](data:image/png;base64,${d.diffBase64.slice(0, 50)}...) |`
      );
    }
    lines.push('');
  }

  if (minor.length > 0) {
    lines.push('### Minor Changes (below threshold)');
    lines.push('');
    lines.push('| Page | Diff % |');
    lines.push('| --- | ---: |');
    for (const d of minor) {
      lines.push(`| ${d.url} | ${d.diffPercentage}% |`);
    }
    lines.push('');
  }

  lines.push(
    `*Threshold: ${THRESHOLD_PERCENTAGE}% pixel difference. Images are embedded as base64 data URIs.*`
  );

  return lines.join('\n');
}
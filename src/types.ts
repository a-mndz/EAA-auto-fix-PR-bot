export interface AxeViolation {
  ruleId: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  pageUrl: string;
  target: string;
  html: string;
  helpUrl: string;
  wcagRefs: string[];
  description: string;
}

export interface ScreenshotData {
  url: string;
  path: string;
  base64: string;
  timestamp: Date;
}

export interface ScanResult {
  url: string;
  title: string;
  violationCount: number;
  violations: AxeViolation[];
  error?: string;
  screenshots?: ScreenshotData[];
}

export interface ScanResultWithScreenshots {
  results: ScanResult[];
  screenshots: ScreenshotData[];
}

export interface FilePatch {
  path: string;
  content: string;
}

export interface FixBundle {
  ruleIds: string[];
  patches: FilePatch[];
  source: 'deterministic' | 'llm';
  model?: string;
  llmCostUsd: number;
}

/** Untrusted scraped content must pass sanitizePageContent before entering an LLM prompt. */
export interface ScannedSnippet {
  ruleId: string;
  target: string;
  sanitizedHtml: string;
}

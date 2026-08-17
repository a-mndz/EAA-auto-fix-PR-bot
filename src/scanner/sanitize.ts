const MAX_SNIPPET_CHARS = 800;

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /\[system\]/i,
  /do\s+anything\s+now/i,
  /<\|im_start\|>/,
];

/**
 * Scraped page content is untrusted input. Strips interactive vectors and
 * truncates before the content is allowed into an LLM prompt.
 */
export function sanitizePageContent(html: string): string {
  let out = html;
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '[script removed]');
  out = out.replace(/<style[\s\S]*?<\/style>/gi, '[style removed]');
  out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/(javascript|vbscript|data)\s*:/gi, '[scheme removed]');
  out = out.replace(/<!--[\s\S]*?-->/g, '[comment removed]');
  if (out.length > MAX_SNIPPET_CHARS) {
    out = `${out.slice(0, MAX_SNIPPET_CHARS)}…[truncated]`;
  }
  return out;
}

/** True when the snippet contains phrases characteristic of prompt-injection attempts. */
export function detectInjectionAttempt(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

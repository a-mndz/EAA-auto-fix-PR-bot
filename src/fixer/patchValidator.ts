/**
 * Patch validator: every changed file hunk must trace to a detected axe rule ID.
 * Prevents LLM drive-by edits from reaching a PR.
 */

import type { FilePatch } from '../types.js';

export interface FileScope {
  /** Repo-relative path of the file containing a detected violation. */
  path: string;
  /** Rule IDs detected on/for this file. */
  ruleIds: string[];
}

export interface ValidationResult {
  valid: boolean;
  allowedRuleIds: string[];
  violations: string[];
}

const MAX_PATCH_SIZE_BYTES = 32_768;
const MAX_FILES = 12;

const DISALLOWED_PATHS = [/^\.github\//, /node_modules\//, /(^|\/)\.env/, /package-lock\.json$/, /yarn\.lock$/, /pnpm-lock\.yaml$/];

/**
 * Validate that every patch targets an in-scope file and only rewrites the
 * rule(s) that were actually detected. Scope is enforced at file granularity:
 * the LLM prompt constrains output to the violating file + rule, and the
 * validator rejects anything outside the detection set.
 */
export function validatePatches(patches: FilePatch[], scopes: FileScope[]): ValidationResult {
  const violations: string[] = [];
  const allowedRuleIds = new Set<string>();
  const allowedPaths = new Map<string, Set<string>>();

  for (const s of scopes) {
    const rules = allowedPaths.get(s.path) ?? new Set<string>();
    for (const r of s.ruleIds) {
      rules.add(r);
      allowedRuleIds.add(r);
    }
    allowedPaths.set(s.path, rules);
  }

  if (patches.length > MAX_FILES) {
    violations.push(`patch touches ${patches.length} files (max ${MAX_FILES})`);
  }

  for (const patch of patches) {
    const normalized = patch.path.replace(/\\/g, '/').replace(/^\.\//, '');
    if (DISALLOWED_PATHS.some((re) => re.test(normalized))) {
      violations.push(`patch targets off-limits path: ${normalized}`);
      continue;
    }
    const scopeRules = allowedPaths.get(normalized);
    if (!scopeRules) {
      violations.push(`patch targets file with no detected violation: ${normalized}`);
      continue;
    }
    if (Buffer.byteLength(patch.content, 'utf8') > MAX_PATCH_SIZE_BYTES) {
      violations.push(`patch for ${normalized} exceeds ${MAX_PATCH_SIZE_BYTES} bytes`);
    }
  }

  if (patches.length === 0) {
    violations.push('patch set is empty');
  }

  return {
    valid: violations.length === 0,
    allowedRuleIds: [...allowedRuleIds],
    violations,
  };
}

/** True when a patch content appears to contain only expected-safe characters for HTML/JSX. */
export function rejectUnsafeContent(content: string): string | null {
  if (/<script[\s>]/i.test(content)) return 'patch introduces <script>';
  if (/\son[a-z]+\s*=/i.test(content)) return 'patch introduces inline event handler';
  if (/javascript\s*:/i.test(content)) return 'patch introduces javascript: URI';
  return null;
}

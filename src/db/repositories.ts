import type { Db } from './pool.js';
import type { AxeViolation } from '../types.js';
import type { ScreenshotData } from '../types.js';

export async function ensureInstallation(
  db: Db,
  installationId: number,
  accountLogin: string,
): Promise<number> {
  const res = await db.query(
    `INSERT INTO installations (github_installation_id, account_login)
     VALUES ($1, $2)
     ON CONFLICT (github_installation_id) DO UPDATE SET account_login = EXCLUDED.account_login
      RETURNING id`,
    [installationId, accountLogin],
  );
  return res.rows[0].id as number;
}

export async function getStripeCustomerId(db: Db, installationDbId: number): Promise<string | null> {
  const res = await db.query(
    `SELECT stripe_customer_id FROM installations WHERE id = $1`,
    [installationDbId],
  );
  return (res.rows[0]?.stripe_customer_id as string | null) ?? null;
}

export async function setStripeCustomerId(
  db: Db,
  installationDbId: number,
  stripeCustomerId: string,
): Promise<void> {
  await db.query(`UPDATE installations SET stripe_customer_id = $2 WHERE id = $1`, [
    installationDbId,
    stripeCustomerId,
  ]);
}

export async function ensureRepo(
  db: Db,
  installationDbId: number,
  githubRepoId: number,
  fullName: string,
  defaultBranch: string,
): Promise<number> {
  const res = await db.query(
    `INSERT INTO repos (installation_id, github_repo_id, full_name, default_branch)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (github_repo_id) DO UPDATE
       SET full_name = EXCLUDED.full_name, default_branch = EXCLUDED.default_branch
     RETURNING id`,
    [installationDbId, githubRepoId, fullName, defaultBranch],
  );
  return res.rows[0].id as number;
}

export interface RepoRow {
  id: number;
  installation_id: number;
  github_repo_id: number;
  full_name: string;
  default_branch: string;
  /** Raw JSON text array; parse with parseRepoUrls. */
  urls: string;
  baseline_violations: number;
  llm_spend_usd: string;
}

/** urls is persisted as a JSON text column. */
export function parseRepoUrls(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : [];
  } catch {
    return [];
  }
}

export async function getRepoByGithubId(db: Db, githubRepoId: number): Promise<RepoRow | null> {
  const res = await db.query(`SELECT * FROM repos WHERE github_repo_id = $1`, [githubRepoId]);
  return res.rows[0] ?? null;
}

export async function setRepoUrls(db: Db, repoDbId: number, urls: string[]): Promise<void> {
  await db.query(`UPDATE repos SET urls = $2 WHERE id = $1`, [repoDbId, JSON.stringify(urls)]);
}

export async function createScan(
  db: Db,
  repoDbId: number,
  kind: string,
  triggeredBy: string,
): Promise<number> {
  const res = await db.query(
    `INSERT INTO scans (repo_id, kind, triggered_by) VALUES ($1, $2, $3) RETURNING id`,
    [repoDbId, kind, triggeredBy],
  );
  return res.rows[0].id as number;
}

export async function completeScan(
  db: Db,
  scanId: number,
  pagesScanned: number,
  violationCount: number,
  newViolationCount: number,
): Promise<void> {
  await db.query(
    `UPDATE scans
     SET status = 'completed', pages_scanned = $2, violation_count = $3,
         new_violation_count = $4, completed_at = now()
     WHERE id = $1`,
    [scanId, pagesScanned, violationCount, newViolationCount],
  );
}

export async function failScan(db: Db, scanId: number, error: string): Promise<void> {
  await db.query(
    `UPDATE scans SET status = 'failed', error = $2, completed_at = now() WHERE id = $1`,
    [scanId, error],
  );
}

/** Insert violations that are not already open for this repo (dedupe on rule + target + page). */
export async function insertNewViolations(
  db: Db,
  scanId: number,
  repoDbId: number,
  violations: AxeViolation[],
): Promise<number> {
  let inserted = 0;
  for (const v of violations) {
    const existing = await db.query(
      `SELECT id FROM violations
       WHERE repo_id = $1 AND rule_id = $2 AND page_url = $3 AND target = $4
         AND fix_status IN ('open', 'fix_pending', 'fix_pr_open')`,
      [repoDbId, v.ruleId, v.pageUrl, v.target],
    );
    if (existing.rows.length > 0) continue;
    await db.query(
      `INSERT INTO violations
         (scan_id, repo_id, rule_id, impact, page_url, target, html_excerpt, help_url, wcag_refs)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [scanId, repoDbId, v.ruleId, v.impact, v.pageUrl, v.target, v.html, v.helpUrl, v.wcagRefs],
    );
    inserted += 1;
  }
  return inserted;
}

export interface ViolationRow {
  id: number;
  rule_id: string;
  impact: string | null;
  page_url: string;
  target: string;
  html_excerpt: string | null;
  help_url: string | null;
  wcag_refs: string[];
}

export async function getOpenViolations(db: Db, repoDbId: number): Promise<ViolationRow[]> {
  const res = await db.query(
    `SELECT * FROM violations WHERE repo_id = $1 AND fix_status = 'open' ORDER BY created_at`,
    [repoDbId],
  );
  return res.rows;
}

export async function markViolations(
  db: Db,
  ids: number[],
  status: 'fix_pending' | 'fix_pr_open',
): Promise<void> {
  if (ids.length === 0) return;
  await db.query(`UPDATE violations SET fix_status = $2 WHERE id = ANY($1::bigint[])`, [
    ids,
    status,
  ]);
}

export async function createFixPr(
  db: Db,
  repoDbId: number,
  scanId: number | null,
  branch: string,
  ruleIds: string[],
): Promise<number> {
  const res = await db.query(
    `INSERT INTO fix_prs (repo_id, scan_id, branch, rule_ids, status)
     VALUES ($1, $2, $3, $4, 'generating') RETURNING id`,
    [repoDbId, scanId, branch, ruleIds],
  );
  return res.rows[0].id as number;
}

export async function updateFixPr(
  db: Db,
  fixPrId: number,
  fields: {
    prNumber?: number;
    status?: string;
    filesChanged?: string[];
    llmCostUsd?: number;
    beforeViolations?: number;
    afterViolations?: number;
  },
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (fields.prNumber !== undefined) {
    sets.push(`pr_number = $${i++}`);
    values.push(fields.prNumber);
  }
  if (fields.status !== undefined) {
    sets.push(`status = $${i++}`);
    values.push(fields.status);
  }
  if (fields.filesChanged !== undefined) {
    sets.push(`files_changed = $${i++}`);
    values.push(fields.filesChanged);
  }
  if (fields.llmCostUsd !== undefined) {
    sets.push(`llm_cost_usd = $${i++}`);
    values.push(fields.llmCostUsd);
  }
  if (fields.beforeViolations !== undefined) {
    sets.push(`before_violations = $${i++}`);
    values.push(fields.beforeViolations);
  }
  if (fields.afterViolations !== undefined) {
    sets.push(`after_violations = $${i++}`);
    values.push(fields.afterViolations);
  }
  if (sets.length === 0) return;
  sets.push(`updated_at = now()`);
  values.push(fixPrId);
  await db.query(`UPDATE fix_prs SET ${sets.join(', ')} WHERE id = $${i}`, values);
}

export async function audit(
  db: Db,
  repoDbId: number | null,
  actor: string,
  action: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await db.query(
    `INSERT INTO audit_log (repo_id, actor, action, detail) VALUES ($1, $2, $3, $4)`,
    [repoDbId, actor, action, JSON.stringify(detail)],
  );
}

export async function recordUsage(
  db: Db,
  repoDbId: number,
  kind: 'merged_fix' | 'page_scanned',
  quantity = 1,
): Promise<void> {
  await db.query(
    `INSERT INTO usage (repo_id, kind, quantity) VALUES ($1, $2, $3)`,
    [repoDbId, kind, quantity],
  );
}

/** Add LLM spend to a repo; resets the running total when the billing period rolled over. */
export async function addLlmSpend(db: Db, repoDbId: number, usd: number): Promise<number> {
  const res = await db.query(
    `UPDATE repos AS r SET
       llm_spend_period = CASE
         WHEN date_trunc('month', now())::date > r.llm_spend_period
           THEN date_trunc('month', now())::date
         ELSE r.llm_spend_period END,
       llm_spend_usd = CASE
         WHEN date_trunc('month', now())::date > r.llm_spend_period THEN $2::numeric
         ELSE r.llm_spend_usd + $2::numeric END
     WHERE r.id = $1
     RETURNING llm_spend_usd`,
    [repoDbId, usd],
  );
  return parseFloat(res.rows[0]?.llm_spend_usd ?? '0');
}

export async function countOpenViolation(db: Db, repoDbId: number): Promise<number> {
  const res = await db.query(
    `SELECT count(*)::int AS n FROM violations
     WHERE repo_id = $1 AND fix_status IN ('open', 'fix_pending', 'fix_pr_open')`,
    [repoDbId],
  );
  return res.rows[0].n as number;
}

export async function resolveViolationsAsFixed(
  db: Db,
  repoDbId: number,
  ruleIds: string[],
): Promise<void> {
  await db.query(
    `UPDATE violations SET fix_status = 'fixed'
     WHERE repo_id = $1 AND rule_id = ANY($2::text[])
       AND fix_status IN ('open', 'fix_pending', 'fix_pr_open')`,
    [repoDbId, ruleIds],
  );
}

export async function storeScreenshots(
  db: Db,
  scanId: number,
  screenshots: ScreenshotData[],
): Promise<void> {
  for (const s of screenshots) {
    await db.query(
      `INSERT INTO screenshots (scan_id, url, path, image_base64, taken_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [scanId, s.url, s.path, s.base64, s.timestamp],
    );
  }
}

export async function getScreenshotsForScan(
  db: Db,
  scanId: number,
): Promise<ScreenshotData[]> {
  const res = await db.query(
    `SELECT url, path, image_base64, taken_at FROM screenshots WHERE scan_id = $1 ORDER BY taken_at`,
    [scanId],
  );
  return res.rows.map((r) => ({
    url: r.url,
    path: r.path,
    base64: r.image_base64,
    timestamp: r.taken_at,
  }));
}

export async function getLatestBaselineScreenshots(
  db: Db,
  repoDbId: number,
): Promise<ScreenshotData[]> {
  const res = await db.query(
    `SELECT s.url, s.path, s.image_base64, s.taken_at
     FROM screenshots s
     JOIN scans sc ON s.scan_id = sc.id
     WHERE sc.repo_id = $1 AND sc.kind = 'baseline' AND sc.status = 'completed'
     ORDER BY s.taken_at DESC`,
    [repoDbId],
  );
  return res.rows.map((r) => ({
    url: r.url,
    path: r.path,
    base64: r.image_base64,
    timestamp: r.taken_at,
  }));
}

import { Worker } from 'bullmq';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import {
  addLlmSpend,
  audit,
  createFixPr,
  getOpenViolations,
  getRepoByGithubId,
  getLatestBaselineScreenshots,
  markViolations,
  parseRepoUrls,
  updateFixPr,
} from '../db/repositories.js';
import { getInstallationClient } from '../github.js';
import { generateFixes } from '../fixer/generate.js';
import { validatePatches, rejectUnsafeContent } from '../fixer/patchValidator.js';
import { sanitizePageContent, detectInjectionAttempt } from '../scanner/sanitize.js';
import { scanPages } from '../scanner/runner.js';
import { branchName, publishFixPr } from '../prbot.js';
import { checkRepoSpendCap } from '../costGuard.js';
import { locateViolationFiles } from './fileLocator.js';
import { fixQueue, type FixJob } from '../queues.js';
import { compareScreenshots, renderDiffComment } from '../scanner/visualDiff.js';

async function handle(job: FixJob): Promise<void> {
  const repo = await getRepoByGithubId(pool, job.githubRepoId);
  if (!repo) throw new Error(`repo ${job.githubRepoId} not found`);

  checkRepoSpendCap(repo);

  const [owner, repoName] = job.fullRepo.split('/');
  if (!owner || !repoName) throw new Error(`invalid repo full name: ${job.fullRepo}`);

  const open = await getOpenViolations(pool, repo.id);
  if (open.length === 0) return;

  const installationId = (
    await pool.query(`SELECT github_installation_id FROM installations WHERE id = $1`, [
      repo.installation_id,
    ])
  ).rows[0]?.github_installation_id as number;
  const octokit = await getInstallationClient(installationId);

  const axeViolations = open.map((v) => ({
    ruleId: v.rule_id,
    impact: (v.impact as 'minor' | 'moderate' | 'serious' | 'critical' | null) ?? null,
    pageUrl: v.page_url,
    target: v.target,
    html: v.html_excerpt ?? '',
    helpUrl: v.help_url ?? '',
    wcagRefs: v.wcag_refs ?? [],
    description: '',
  }));

  for (const v of axeViolations) {
    if (detectInjectionAttempt(v.html)) {
      await audit(pool, repo.id, 'fix-worker', 'prompt_injection_blocked', { rule: v.ruleId });
      v.html = '';
    }
  }

  const byFile = await locateViolationFiles(octokit, owner, repoName, job.branch, axeViolations);
  if (byFile.size === 0) {
    await audit(pool, repo.id, 'fix-worker', 'no_source_match', { violations: open.length });
    return;
  }

  const targets = [...byFile.entries()].map(([path, { content, violations }]) => ({
    path,
    content,
    violations,
  }));

  const fix = await generateFixes(targets, sanitizePageContent);
  if (fix.patches.length === 0) {
    await audit(pool, repo.id, 'fix-worker', 'no_patches', { notes: fix.notes });
    return;
  }

  const scopes = targets.map((t) => ({
    path: t.path,
    ruleIds: [...new Set(t.violations.map((v) => v.ruleId))],
  }));
  const validation = validatePatches(fix.patches, scopes);
  if (!validation.valid) {
    await audit(pool, repo.id, 'fix-worker', 'patch_rejected', {
      violations: validation.violations,
    });
    return;
  }
  for (const p of fix.patches) {
    const unsafe = rejectUnsafeContent(p.content);
    if (unsafe) {
      await audit(pool, repo.id, 'fix-worker', 'unsafe_patch_rejected', {
        path: p.path,
        reason: unsafe,
      });
      return;
    }
  }

  const branch = branchName(fix.ruleIdsHandled);
  const prId = await createFixPr(pool, repo.id, job.scanId, branch, fix.ruleIdsHandled);
  await markViolations(pool, open.map((v) => v.id), 'fix_pending');

  const urls = parseRepoUrls(repo.urls);
  const beforeScan =
    urls.length > 0
      ? await scanPages(urls, {
          maxPages: config.scan.maxPages,
          timeoutMs: config.scan.timeoutMs,
        })
      : { results: [], screenshots: [] };

  const baselineScreenshots = await getLatestBaselineScreenshots(pool, repo.id);

  const result = await publishFixPr(octokit, {
    owner,
    repo: repoName,
    baseBranch: repo.default_branch,
    branch,
    ruleIds: fix.ruleIdsHandled,
    patches: fix.patches,
    beforeScan: beforeScan.results,
    afterScan: [],
    notes: fix.notes,
    source: fix.model ? 'llm' : 'deterministic',
    llmCostUsd: fix.llmCostUsd,
  });

  if (baselineScreenshots.length > 0 && beforeScan.screenshots.length > 0) {
    const diffs = await compareScreenshots(baselineScreenshots, beforeScan.screenshots);
    const diffComment = renderDiffComment(diffs);
    await octokit.rest.issues.createComment({
      owner,
      repo: repoName,
      issue_number: result.prNumber,
      body: diffComment,
    });
  }

  const totalSpend = await addLlmSpend(pool, repo.id, fix.llmCostUsd);
  await updateFixPr(pool, prId, {
    prNumber: result.prNumber,
    status: 'open',
    filesChanged: fix.patches.map((p) => p.path),
    llmCostUsd: fix.llmCostUsd,
  });
  await markViolations(pool, open.map((v) => v.id), 'fix_pr_open');
  await audit(pool, repo.id, 'fix-worker', 'fix_pr.opened', {
    pr: result.prNumber,
    rules: fix.ruleIdsHandled,
    costUsd: fix.llmCostUsd,
    monthTotalUsd: totalSpend,
  });
}

export function startFixWorker(): Worker<FixJob> {
  const worker = new Worker<FixJob>(
    'fix',
    async (job) => {
      await handle(job.data);
    },
    { connection: { url: config.redisUrl }, concurrency: 1 },
  );
  worker.on('failed', (job, err) => {
    console.error(`[fix] job ${job?.id} failed:`, err);
  });
  return worker;
}

export { fixQueue };

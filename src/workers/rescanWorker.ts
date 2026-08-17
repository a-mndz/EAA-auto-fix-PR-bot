import { Worker } from 'bullmq';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import {
  audit,
  completeScan,
  createScan,
  failScan,
  getRepoByGithubId,
  parseRepoUrls,
  resolveViolationsAsFixed,
  updateFixPr,
} from '../db/repositories.js';
import { createCheckRun, getInstallationClient, getHeadSha, type RepoOctokit } from '../github.js';
import { scanPages } from '../scanner/runner.js';
import { emitMeteredUsage } from '../billing/emit.js';
import { rescanQueue, type RescanJob } from '../queues.js';

async function postMergeCheck(octokit: RepoOctokit, owner: string, repoName: string, defaultBranch: string, regression: boolean, summary: string): Promise<void> {
  const headSha = await getHeadSha(octokit, owner, repoName, defaultBranch);
  await createCheckRun(octokit, owner, repoName, {
    name: 'eaa/rescan',
    headSha,
    status: 'completed',
    conclusion: regression ? 'failure' : 'success',
    title: regression ? 'A11y regression detected' : 'Re-scan clean',
    summary,
  });
}

async function handle(job: RescanJob): Promise<void> {
  const repo = await getRepoByGithubId(pool, job.githubRepoId);
  if (!repo) return;

  const [owner, repoName] = job.fullRepo.split('/');
  if (!owner || !repoName) return;

  const installationId = (
    await pool.query(`SELECT github_installation_id FROM installations WHERE id = $1`, [
      repo.installation_id,
    ])
  ).rows[0]?.github_installation_id as number;
  const octokit = await getInstallationClient(installationId);

  const scanId = await createScan(pool, repo.id, 'postmerge', `pr#${job.prNumber}`);
  try {
    const urls = parseRepoUrls(repo.urls);
    if (urls.length === 0) {
      await completeScan(pool, scanId, 0, 0, 0);
      return;
    }
    const { results } = await scanPages(urls, {
      maxPages: config.scan.maxPages,
      timeoutMs: config.scan.timeoutMs,
    });
    const total = results.reduce((n: number, r: { violationCount: number }) => n + r.violationCount, 0);
    await completeScan(pool, scanId, results.length, total, 0);

    const mergedPr = await pool.query(
      `SELECT id, rule_ids FROM fix_prs
       WHERE repo_id = $1 AND status = 'open' AND pr_number = $2`,
      [repo.id, job.prNumber],
    );
    if (mergedPr.rows[0]) {
      const ruleIds = mergedPr.rows[0].rule_ids as string[];
      await resolveViolationsAsFixed(pool, repo.id, ruleIds);
      await updateFixPr(pool, mergedPr.rows[0].id as number, {
        status: 'merged',
        beforeViolations: repo.baseline_violations,
        afterViolations: total,
      });
      await pool.query(`INSERT INTO usage (repo_id, kind) VALUES ($1, 'merged_fix')`, [repo.id]);
      await emitMeteredUsage(pool, repo.id, repo.installation_id, 'merged_fix', 1);
    }

    const openCount = (
      await pool.query(
        `SELECT count(*)::int AS n FROM violations
         WHERE repo_id = $1 AND fix_status IN ('open', 'fix_pending', 'fix_pr_open')`,
        [repo.id],
      )
    ).rows[0].n as number;
    const baseline = repo.baseline_violations;
    const regression = openCount > baseline;

    await postMergeCheck(
      octokit,
      owner,
      repoName,
      repo.default_branch,
      regression,
      `Open violations: ${openCount} (baseline: ${baseline}). Total scanned: ${total}.`,
    );
    await audit(pool, repo.id, 'rescan-worker', 'rescan.completed', {
      scanId,
      pr: job.prNumber,
      total,
      openCount,
      baseline,
      regression,
    });
  } catch (err) {
    await failScan(pool, scanId, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export function startRescanWorker(): Worker<RescanJob> {
  const worker = new Worker<RescanJob>(
    'rescan',
    async (job) => {
      await handle(job.data);
    },
    { connection: { url: config.redisUrl }, concurrency: 2 },
  );
  worker.on('failed', (job, err) => {
    console.error(`[rescan] job ${job?.id} failed:`, err);
  });
  return worker;
}

export { rescanQueue };

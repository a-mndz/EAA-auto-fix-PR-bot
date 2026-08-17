import { Worker } from 'bullmq';
import { scanPages } from '../scanner/runner.js';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import {
  audit,
  completeScan,
  createScan,
  failScan,
  getRepoByGithubId,
  insertNewViolations,
  parseRepoUrls,
  recordUsage,
  storeScreenshots,
} from '../db/repositories.js';
import { fixQueue, scanQueue, type ScanJob } from '../queues.js';
import { emitMeteredUsage } from '../billing/emit.js';
import type { AxeViolation } from '../types.js';

async function handle(job: ScanJob): Promise<void> {
  const repo = await getRepoByGithubId(pool, job.githubRepoId);
  if (!repo) {
    console.warn(`[scan] unknown repo ${job.fullRepo}; skipping`);
    return;
  }

  const urls = parseRepoUrls(repo.urls);
  if (urls.length === 0) {
    console.warn(`[scan] repo ${repo.full_name} has no configured URLs; skipping`);
    return;
  }

  const scanId = await createScan(pool, repo.id, job.kind, job.triggeredBy);
  try {
    const { results, screenshots } = await scanPages(urls, {
      maxPages: config.scan.maxPages,
      timeoutMs: config.scan.timeoutMs,
      captureScreenshots: job.kind === 'baseline' || job.kind === 'premerge',
    });
    const all = results.flatMap((r: { violations: AxeViolation[] }) => r.violations);
    const inserted = await insertNewViolations(pool, scanId, repo.id, all);
    await completeScan(pool, scanId, results.length, all.length, inserted);
    await recordUsage(pool, repo.id, 'page_scanned', results.length);
    await emitMeteredUsage(pool, repo.id, repo.installation_id, 'page_scanned', results.length);

    if (screenshots.length > 0) {
      await storeScreenshots(pool, scanId, screenshots);
    }

    if (job.kind === 'baseline') {
      await pool.query(`UPDATE repos SET baseline_violations = $2 WHERE id = $1`, [
        repo.id,
        all.length,
      ]);
    }

    await audit(pool, repo.id, 'scan-worker', 'scan.completed', {
      scanId,
      kind: job.kind,
      violations: all.length,
      newViolations: inserted,
    });

    if (inserted > 0) {
      await fixQueue.add(
        'fix',
        {
          githubRepoId: job.githubRepoId,
          fullRepo: job.fullRepo,
          branch: job.branch ?? repo.default_branch,
          scanId,
        },
        { attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
      );
    }
  } catch (err) {
    await failScan(pool, scanId, err instanceof Error ? err.message : String(err));
    await audit(pool, repo.id, 'scan-worker', 'scan.failed', {
      scanId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export function startScanWorker(): Worker<ScanJob> {
  const worker = new Worker<ScanJob>(
    'scan',
    async (job) => {
      await handle(job.data);
    },
    { connection: { url: config.redisUrl }, concurrency: 2 },
  );
  worker.on('failed', (job, err) => {
    console.error(`[scan] job ${job?.id} failed:`, err);
  });
  return worker;
}

/** Convenience entry for tests / CLI-driven baseline scans. */
export { scanQueue };

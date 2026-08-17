import express from 'express';
import { Webhooks, type EmitterWebhookEvent } from '@octokit/webhooks';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { demoScan } from './demo/scan.js';
import { pool } from './db/pool.js';
import {
  ensureInstallation,
  ensureRepo,
  setRepoUrls,
  getStripeCustomerId,
  setStripeCustomerId,
  audit,
} from './db/repositories.js';
import { stripeEnabled, getOrCreateStripeCustomer, createCheckoutSession } from './billing/stripe.js';
import { scanQueue, rescanQueue, closeQueues } from './queues.js';
import { startScanWorker } from './workers/scanWorker.js';
import { startFixWorker } from './workers/fixWorker.js';
import { startRescanWorker } from './workers/rescanWorker.js';

const KNOWN_EVENTS = ['installation', 'installation_repositories', 'push', 'pull_request'];

const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Simple fixed-window per-IP limiter for the public demo scan endpoint. */
function createDemoRateLimiter(windowMs: number, max: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const now = Date.now();
    const ip = req.ip ?? 'unknown';
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
    const entry = hits.get(ip);
    if (entry && entry.count >= max) {
      res.status(429).json({ error: 'too many scans; try again in a minute' });
      return;
    }
    if (entry) {
      entry.count += 1;
    } else {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
    }
    next();
  };
}

type WorkerHandle = { close: () => Promise<void> };

async function tryStartWorkers(): Promise<WorkerHandle[]> {
  const workers: WorkerHandle[] = [];
  try {
    workers.push(startScanWorker());
    workers.push(startFixWorker());
    workers.push(startRescanWorker());
    console.log(`[server] workers started: ${workers.length}`);
  } catch (err) {
    console.warn(`[server] workers not started (missing Redis?): ${(err as Error).message}`);
  }
  return workers;
}

export function createApp(): express.Express {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  /** Landing page + static assets, served from the app itself. */
  app.use(express.static(join(PROJECT_ROOT, 'landing')));

  /**
   * Public demo: run the production axe-core scan against a prospect URL.
   * SSRF-guarded: http(s) only, no internal hostnames/IPs, DNS-gated,
   * rate-limited, 30s timeout. Returns at most 12 violations, impact-sorted.
   */
  app.post('/api/demo-scan', express.json(), createDemoRateLimiter(60_000, 10), async (req, res) => {
    try {
      const outcome = await demoScan(req.body?.url);
      res.json(outcome);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = (err as { statusCode?: number }).statusCode ?? (message === 'host not allowed' ? 403 : 502);
      res.status(status).json({ error: message });
    }
  });

  if (config.requireGitHubApp()) {
    const webhooks = new Webhooks({ secret: config.github.webhookSecret });

    webhooks.on('installation.created', async ({ payload }) => {
      const login = (payload.installation.account as { login?: string } | undefined)?.login ?? 'unknown';
      const dbId = await ensureInstallation(pool, payload.installation.id, login);
      for (const repo of payload.repositories ?? []) {
        await ensureRepo(pool, dbId, repo.id, repo.full_name, 'main');
      }
    });

    webhooks.on('installation_repositories.added', async ({ payload }) => {
      const login = (payload.installation.account as { login?: string } | undefined)?.login ?? 'unknown';
      const dbId = await ensureInstallation(pool, payload.installation.id, login);
      for (const repo of payload.repositories_added) {
        await ensureRepo(pool, dbId, repo.id, repo.full_name, 'main');
      }
    });

    webhooks.on('push', async ({ payload }) => {
      if (payload.ref !== `refs/heads/${payload.repository.default_branch}`) return;
      await scanQueue.add(
        'scan',
        {
          kind: 'scheduled',
          githubRepoId: payload.repository.id,
          fullRepo: payload.repository.full_name,
          branch: payload.repository.default_branch,
          triggeredBy: `push:${payload.sender?.login ?? 'webhook'}`,
        },
        { attempts: 3, backoff: { type: 'exponential', delay: 10000 } },
      );
    });

    webhooks.on('pull_request.closed', async ({ payload }) => {
      if (!payload.pull_request.merged) return;
      await rescanQueue.add(
        'rescan',
        {
          githubRepoId: payload.repository.id,
          fullRepo: payload.repository.full_name,
          prNumber: payload.number,
        },
        { attempts: 3, backoff: { type: 'exponential', delay: 15000 } },
      );
    });

    app.post(
      '/api/github/webhooks',
      express.raw({ type: 'application/json' }),
      async (req, res) => {
        const signature = req.headers['x-hub-signature-256'];
        const name = req.headers['x-github-event'];
        if (typeof signature !== 'string' || typeof name !== 'string') {
          res.status(400).json({ error: 'missing signature or event header' });
          return;
        }
        const valid = await webhooks.verify(req.body, signature);
        if (!valid) {
          res.status(401).json({ error: 'invalid signature' });
          return;
        }
        res.status(202).json({ received: true });
        if (!KNOWN_EVENTS.includes(name.split('.')[0] ?? '')) return;
        const event = {
          id: req.headers['x-github-delivery'] as string,
          name,
          payload: JSON.parse(req.body.toString()),
        } as EmitterWebhookEvent;
        await webhooks.receive(event);
      },
    );

    /** Manual trigger: configure scan URLs for a repo and run the baseline scan. */
    app.post('/api/repos/:fullName/configure', express.json(), async (req, res) => {
      const fullName = req.params.fullName as string;
      const urls: string[] = req.body?.urls ?? [];
      if (!Array.isArray(urls) || urls.length === 0) {
        res.status(400).json({ error: 'urls[] required' });
        return;
      }
      const row = await pool.query(
        `SELECT id, github_repo_id FROM repos WHERE full_name = $1`,
        [fullName],
      );
      if (!row.rows[0]) {
        res.status(404).json({ error: 'repo not installed' });
        return;
      }
      await setRepoUrls(pool, row.rows[0].id as number, urls);
      await scanQueue.add(
        'scan',
        {
          kind: 'baseline',
          githubRepoId: row.rows[0].github_repo_id as number,
          fullRepo: fullName,
          triggeredBy: 'api:configure',
        },
        { attempts: 2 },
      );
      res.status(202).json({ queued: 'baseline-scan' });
    });
  } else {
    console.warn('[server] GitHub App credentials missing; webhook routes disabled');
  }

  if (stripeEnabled()) {
    /** Start a Stripe Checkout for a repo's installation (subscription + metered fixes). */
    app.post('/api/billing/checkout/:fullName', express.json(), async (req, res) => {
      const fullName = req.params.fullName as string;
      const row = await pool.query(`SELECT id, installation_id FROM repos WHERE full_name = $1`, [
        fullName,
      ]);
      const repo = row.rows[0];
      if (!repo) {
        res.status(404).json({ error: 'repo not installed' });
        return;
      }
      const inst = await pool.query(`SELECT id, account_login FROM installations WHERE id = $1`, [
        repo.installation_id,
      ]);
      const installation = inst.rows[0];
      const customerId = await getOrCreateStripeCustomer(
        installation.id,
        installation.account_login,
        () => getStripeCustomerId(pool, installation.id),
        (id) => setStripeCustomerId(pool, installation.id, id),
      );
      if (!customerId) {
        res.status(502).json({ error: 'could not create billing customer' });
        return;
      }
      const lineItems = config.billing.basePriceId
        ? [{ price: config.billing.basePriceId }]
        : [];
      if (config.billing.fixPriceId) lineItems.push({ price: config.billing.fixPriceId });
      const url = await createCheckoutSession({
        customerId,
        successUrl: `${req.protocol}://${req.get('host')}/?checkout=success`,
        cancelUrl: `${req.protocol}://${req.get('host')}/?checkout=cancel`,
        lineItems,
      });
      if (!url) {
        res.status(502).json({ error: 'checkout session failed' });
        return;
      }
      res.status(200).json({ url });
    });

    app.post(
      '/api/billing/webhook',
      express.raw({ type: 'application/json' }),
      async (req, res) => {
        const sig = req.headers['stripe-signature'] as string;
        if (!config.billing.webhookSecret || !sig) {
          res.status(400).json({ error: 'missing signature' });
          return;
        }
        let event: unknown;
        try {
          const stripe = await import('stripe');
          const payload = req.body as Buffer;
          event = stripe.default.webhooks.constructEvent(
            payload,
            sig,
            config.billing.webhookSecret,
          );
        } catch {
          res.status(400).json({ error: 'invalid signature' });
          return;
        }
        const e = event as { type: string; data: { object: { metadata?: Record<string, string> } } };
        await audit(pool, null, 'billing', `stripe.${e.type}`, e.data.object.metadata ?? {});
        res.json({ received: true });
      },
    );
  }

  /** EAA audit evidence export: scan history + fix log for a repository. */
  app.get('/api/repos/:fullName/audit', async (req, res) => {
    const fullName = req.params.fullName as string;
    const repo = await pool.query(
      `SELECT r.*, i.account_login FROM repos r
       JOIN installations i ON r.installation_id = i.id
       WHERE r.full_name = $1`,
      [fullName],
    );
    if (!repo.rows[0]) {
      res.status(404).json({ error: 'repo not found' });
      return;
    }
    const repoRow = repo.rows[0];

    const scans = await pool.query(
      `SELECT * FROM scans WHERE repo_id = $1 ORDER BY created_at DESC`,
      [repoRow.id],
    );

    const violations = await pool.query(
      `SELECT * FROM violations WHERE repo_id = $1 ORDER BY created_at DESC`,
      [repoRow.id],
    );

    const fixPrs = await pool.query(
      `SELECT * FROM fix_prs WHERE repo_id = $1 ORDER BY created_at DESC`,
      [repoRow.id],
    );

    const auditLog = await pool.query(
      `SELECT * FROM audit_log WHERE repo_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [repoRow.id],
    );

    const usage = await pool.query(
      `SELECT * FROM usage WHERE repo_id = $1 ORDER BY period DESC`,
      [repoRow.id],
    );

    const baselineScreenshots = await pool.query(
      `SELECT s.* FROM screenshots s
       JOIN scans sc ON s.scan_id = sc.id
       WHERE sc.repo_id = $1 AND sc.kind = 'baseline' AND sc.status = 'completed'
       ORDER BY s.taken_at DESC`,
      [repoRow.id],
    );

    res.json({
      repository: {
        fullName: repoRow.full_name,
        defaultBranch: repoRow.default_branch,
        accountLogin: repoRow.account_login,
        baselineViolations: repoRow.baseline_violations,
        llmSpendUsd: repoRow.llm_spend_usd,
        llmSpendPeriod: repoRow.llm_spend_period,
      },
      scans: scans.rows.map((s) => ({
        id: s.id,
        kind: s.kind,
        status: s.status,
        pagesScanned: s.pages_scanned,
        violationCount: s.violation_count,
        newViolationCount: s.new_violation_count,
        triggeredBy: s.triggered_by,
        createdAt: s.created_at,
        completedAt: s.completed_at,
        error: s.error,
      })),
      violations: violations.rows.map((v) => ({
        id: v.id,
        scanId: v.scan_id,
        ruleId: v.rule_id,
        impact: v.impact,
        pageUrl: v.page_url,
        target: v.target,
        fixStatus: v.fix_status,
        createdAt: v.created_at,
      })),
      fixPullRequests: fixPrs.rows.map((f) => ({
        id: f.id,
        scanId: f.scan_id,
        branch: f.branch,
        prNumber: f.pr_number,
        ruleIds: f.rule_ids,
        filesChanged: f.files_changed,
        status: f.status,
        llmCostUsd: f.llm_cost_usd,
        beforeViolations: f.before_violations,
        afterViolations: f.after_violations,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      })),
      auditLog: auditLog.rows.map((a) => ({
        id: a.id,
        actor: a.actor,
        action: a.action,
        detail: a.detail,
        createdAt: a.created_at,
      })),
      usage: usage.rows.map((u) => ({
        id: u.id,
        kind: u.kind,
        quantity: u.quantity,
        period: u.period,
        billedAt: u.billed_at,
      })),
      baselineScreenshots: baselineScreenshots.rows.map((s) => ({
        id: s.id,
        scanId: s.scan_id,
        url: s.url,
        path: s.path,
        takenAt: s.taken_at,
      })),
      exportedAt: new Date().toISOString(),
    });
  });

  return app;
}

export async function main(): Promise<void> {
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] listening on :${config.port}`);
  });

  const workers = await tryStartWorkers();

  const shutdown = async (): Promise<void> => {
    server.close();
    await Promise.all(workers.map((w) => w.close()));
    await closeQueues();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

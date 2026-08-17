import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock all dependencies BEFORE importing server
vi.mock('../src/db/pool.js', () => {
  const mockQuery = vi.fn();
  return {
    pool: {
      query: mockQuery,
      end: vi.fn(),
    },
  };
});

vi.mock('../src/billing/stripe.js', () => ({
  stripeEnabled: () => false,
}));

vi.mock('../src/queues.js', () => ({
  scanQueue: { add: vi.fn(), close: vi.fn() },
  rescanQueue: { add: vi.fn(), close: vi.fn() },
  closeQueues: vi.fn(),
}));

vi.mock('../src/workers/scanWorker.js', () => ({
  startScanWorker: vi.fn(() => ({ close: vi.fn() })),
}));

vi.mock('../src/workers/fixWorker.js', () => ({
  startFixWorker: vi.fn(() => ({ close: vi.fn() })),
}));

vi.mock('../src/workers/rescanWorker.js', () => ({
  startRescanWorker: vi.fn(() => ({ close: vi.fn() })),
}));

vi.mock('../src/config.js', () => ({
  config: {
    port: 3000,
    requireGitHubApp: () => false,
    github: { webhookSecret: 'test' },
    billing: { basePriceId: null, fixPriceId: null, webhookSecret: 'test' },
  },
}));

// Import pool AFTER mocking to get the mocked version
import { pool } from '../src/db/pool.js';
import { createApp } from '../src/server.js';

const mockPool = vi.mocked(pool);

describe('audit export endpoint', () => {
  const mockRepo = {
    id: 1,
    installation_id: 1,
    github_repo_id: 123,
    full_name: 'owner/repo',
    default_branch: 'main',
    urls: '[]',
    baseline_violations: 5,
    llm_spend_usd: '0.00',
    llm_spend_period: new Date(),
    account_login: 'owner',
  };

  const mockScans = [
    {
      id: 1,
      repo_id: 1,
      kind: 'baseline',
      status: 'completed',
      pages_scanned: 2,
      violation_count: 5,
      new_violation_count: 5,
      triggered_by: 'api:configure',
      created_at: new Date(),
      completed_at: new Date(),
      error: null,
    },
  ];

  const mockViolations = [
    {
      id: 1,
      scan_id: 1,
      repo_id: 1,
      rule_id: 'image-alt',
      impact: 'serious',
      page_url: 'https://example.com',
      target: 'img',
      fix_status: 'fixed',
      created_at: new Date(),
    },
  ];

  const mockFixPrs = [
    {
      id: 1,
      repo_id: 1,
      scan_id: 1,
      branch: 'eaa-fix/image-alt',
      pr_number: 42,
      rule_ids: ['image-alt'],
      files_changed: ['src/index.html'],
      status: 'merged',
      llm_cost_usd: '0.00',
      before_violations: 5,
      after_violations: 0,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  const mockAuditLog = [
    {
      id: 1,
      repo_id: 1,
      actor: 'scan-worker',
      action: 'scan.completed',
      detail: { violations: 5 },
      created_at: new Date(),
    },
  ];

  const mockUsage = [
    {
      id: 1,
      repo_id: 1,
      kind: 'page_scanned',
      quantity: 2,
      period: new Date(),
      billed_at: new Date(),
    },
  ];

  const mockScreenshots = [
    {
      id: 1,
      scan_id: 1,
      url: 'https://example.com',
      path: 'https___example_com',
      image_base64: 'base64data',
      taken_at: new Date(),
    },
  ];

  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns 404 for unknown repo', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/repos/unknown-repo/audit');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'repo not found' });
  });

  it('returns full audit export for known repo', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [mockRepo] })
      .mockResolvedValueOnce({ rows: mockScans })
      .mockResolvedValueOnce({ rows: mockViolations })
      .mockResolvedValueOnce({ rows: mockFixPrs })
      .mockResolvedValueOnce({ rows: mockAuditLog })
      .mockResolvedValueOnce({ rows: mockUsage })
      .mockResolvedValueOnce({ rows: mockScreenshots });

    const res = await request(app).get('/api/repos/owner-repo/audit');

    expect(res.status).toBe(200);
    expect(res.body.repository.fullName).toBe('owner/repo');
    expect(res.body.scans).toHaveLength(1);
    expect(res.body.violations).toHaveLength(1);
    expect(res.body.fixPullRequests).toHaveLength(1);
    expect(res.body.auditLog).toHaveLength(1);
    expect(res.body.usage).toHaveLength(1);
    expect(res.body.baselineScreenshots).toHaveLength(1);
    expect(res.body.exportedAt).toBeDefined();
  });
});
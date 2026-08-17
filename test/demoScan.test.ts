import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock all dependencies BEFORE importing server (same pattern as auditExport.test.ts)
vi.mock('../src/db/pool.js', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })), end: vi.fn() },
}));

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

vi.mock('../src/demo/scan.js', () => ({
  demoScan: vi.fn(),
}));

import { createApp } from '../src/server.js';
import { demoScan } from '../src/demo/scan.js';

const mockDemoScan = vi.mocked(demoScan);

describe('GET /health and static landing', () => {
  it('serves the health endpoint', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('serves the landing page at /', async () => {
    const app = createApp();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('EAA Fix');
  });
});

describe('POST /api/demo-scan', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns the scan outcome for an accepted URL', async () => {
    mockDemoScan.mockResolvedValueOnce({
      url: 'https://example.com/',
      title: 'Example',
      violationCount: 3,
      violations: [
        {
          ruleId: 'image-alt',
          impact: 'critical',
          target: 'img',
          help: 'Images must have alternative text',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
          wcagRefs: ['wcag111'],
          nodes: 2,
        },
      ],
    });

    const res = await request(app)
      .post('/api/demo-scan')
      .send({ url: 'https://example.com' });

    expect(mockDemoScan).toHaveBeenCalledWith('https://example.com');
    expect(res.status).toBe(200);
    expect(res.body.violationCount).toBe(3);
    expect(res.body.violations[0].ruleId).toBe('image-alt');
  });

  it('maps validation refusals to 400', async () => {
    mockDemoScan.mockRejectedValueOnce(
      Object.assign(new Error('url required'), { statusCode: 400 }),
    );

    const res = await request(app).post('/api/demo-scan').send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'url required' });
  });

  it('maps host refusals to 403', async () => {
    mockDemoScan.mockRejectedValueOnce(new Error('host not allowed'));

    const res = await request(app)
      .post('/api/demo-scan')
      .send({ url: 'http://169.254.169.254/latest/meta-data' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'host not allowed' });
  });

  it('maps scan failures to 502', async () => {
    mockDemoScan.mockRejectedValueOnce(new Error('Target page, context or browser has been closed'));

    const res = await request(app)
      .post('/api/demo-scan')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(502);
    expect(res.body.error).toContain('closed');
  });

  it('rate-limits after 10 scans per window', async () => {
    for (let i = 0; i < 10; i++) {
      mockDemoScan.mockResolvedValueOnce({
        url: 'https://example.com/',
        title: 'Example',
        violationCount: 0,
        violations: [],
      });
      const ok = await request(app).post('/api/demo-scan').send({ url: 'https://example.com' });
      expect(ok.status).toBe(200);
    }

    const blocked = await request(app)
      .post('/api/demo-scan')
      .send({ url: 'https://example.com' });
    expect(blocked.status).toBe(429);
    expect(mockDemoScan).toHaveBeenCalledTimes(10);
  });
});
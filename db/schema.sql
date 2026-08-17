CREATE TABLE IF NOT EXISTS installations (
  id BIGSERIAL PRIMARY KEY,
  github_installation_id BIGINT NOT NULL UNIQUE,
  account_login TEXT NOT NULL,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installations_stripe ON installations (stripe_customer_id);

CREATE TABLE IF NOT EXISTS repos (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id),
  github_repo_id BIGINT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  urls TEXT NOT NULL DEFAULT '[]',
  baseline_violations INTEGER NOT NULL DEFAULT 0,
  llm_spend_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  llm_spend_period DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scans (
  id BIGSERIAL PRIMARY KEY,
  repo_id BIGINT NOT NULL REFERENCES repos (id),
  kind TEXT NOT NULL CHECK (kind IN ('baseline', 'scheduled', 'premerge', 'postmerge')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  pages_scanned INTEGER NOT NULL DEFAULT 0,
  violation_count INTEGER,
  new_violation_count INTEGER,
  error TEXT,
  triggered_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS violations (
  id BIGSERIAL PRIMARY KEY,
  scan_id BIGINT NOT NULL REFERENCES scans (id),
  repo_id BIGINT NOT NULL REFERENCES repos (id),
  rule_id TEXT NOT NULL,
  impact TEXT,
  page_url TEXT NOT NULL,
  target TEXT NOT NULL,
  html_excerpt TEXT,
  help_url TEXT,
  wcag_refs TEXT[] NOT NULL DEFAULT '{}',
  fix_status TEXT NOT NULL DEFAULT 'open' CHECK (
    fix_status IN ('open', 'fix_pending', 'fix_pr_open', 'fixed', 'wontfix')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_violations_repo_status ON violations (repo_id, fix_status);
CREATE INDEX IF NOT EXISTS idx_violations_repo_rule ON violations (repo_id, rule_id);

CREATE TABLE IF NOT EXISTS fix_prs (
  id BIGSERIAL PRIMARY KEY,
  repo_id BIGINT NOT NULL REFERENCES repos (id),
  scan_id BIGINT REFERENCES scans (id),
  branch TEXT NOT NULL,
  pr_number INTEGER,
  rule_ids TEXT[] NOT NULL,
  files_changed TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('generating', 'open', 'merged', 'closed', 'failed')
  ),
  llm_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  before_violations INTEGER,
  after_violations INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  repo_id BIGINT REFERENCES repos (id),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_repo_time ON audit_log (repo_id, created_at DESC);

CREATE TABLE IF NOT EXISTS usage (
  id BIGSERIAL PRIMARY KEY,
  repo_id BIGINT NOT NULL REFERENCES repos (id),
  kind TEXT NOT NULL CHECK (kind IN ('merged_fix', 'page_scanned')),
  quantity INTEGER NOT NULL DEFAULT 1,
  period DATE NOT NULL DEFAULT now()::date,
  billed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_usage_unbilled ON usage (kind, period) WHERE billed_at IS NULL;

CREATE TABLE IF NOT EXISTS screenshots (
  id BIGSERIAL PRIMARY KEY,
  scan_id BIGINT NOT NULL REFERENCES scans (id),
  url TEXT NOT NULL,
  path TEXT NOT NULL,
  image_base64 TEXT NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_screenshots_scan ON screenshots (scan_id);

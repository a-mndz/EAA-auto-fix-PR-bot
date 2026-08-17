import { z } from 'zod';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),

    DATABASE_URL: z.string().default('postgres://eaa:eaa@127.0.0.1:5432/eaa_autofix'),
    REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

    GITHUB_APP_ID: z.string().optional(),
    GITHUB_APP_PRIVATE_KEY: z.string().optional(),
    GITHUB_WEBHOOK_SECRET: z.string().default(''),

    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_SONNET_MODEL: z.string().default('claude-sonnet-4-5'),
    ANTHROPIC_HAIKU_MODEL: z.string().default('claude-haiku-4-5'),

    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_METER_FIXES: z.string().default('eaa_merged_fix'),
    STRIPE_METER_PAGES: z.string().default('eaa_page_scanned'),
    STRIPE_BASE_PRICE_ID: z.string().optional(),
    STRIPE_FIX_PRICE_ID: z.string().optional(),

    MAX_LLM_COST_PER_FIX_USD: z.coerce.number().default(0.05),
    REPO_MONTHLY_LLM_CAP_USD: z.coerce.number().default(25),
    SCAN_MAX_PAGES: z.coerce.number().default(25),
    SCAN_TIMEOUT_MS: z.coerce.number().default(120000),
  })
  .parse(process.env);

const isDev = EnvSchema.NODE_ENV !== 'production';

export const config = {
  env: EnvSchema.NODE_ENV,
  port: EnvSchema.PORT,

  databaseUrl: EnvSchema.DATABASE_URL,
  redisUrl: EnvSchema.REDIS_URL,

  github: {
    appId: EnvSchema.GITHUB_APP_ID,
    privateKey: EnvSchema.GITHUB_APP_PRIVATE_KEY,
    webhookSecret: EnvSchema.GITHUB_WEBHOOK_SECRET,
  },

  billing: {
    secretKey: EnvSchema.STRIPE_SECRET_KEY,
    webhookSecret: EnvSchema.STRIPE_WEBHOOK_SECRET,
    meterFixes: EnvSchema.STRIPE_METER_FIXES,
    meterPages: EnvSchema.STRIPE_METER_PAGES,
    basePriceId: EnvSchema.STRIPE_BASE_PRICE_ID,
    fixPriceId: EnvSchema.STRIPE_FIX_PRICE_ID,
    /** Pages included in the base plan before metering kicks in. */
    monthlyPageQuota: 200,
    /** Per-unit metered prices (USD) used for invoice preview only. */
    pricePerMergedFixUsd: 4,
    pricePerPageUsd: 0.1,
  },

  llm: {
    apiKey: EnvSchema.ANTHROPIC_API_KEY,
    sonnetModel: EnvSchema.ANTHROPIC_SONNET_MODEL,
    haikuModel: EnvSchema.ANTHROPIC_HAIKU_MODEL,
    maxCostPerFixUsd: EnvSchema.MAX_LLM_COST_PER_FIX_USD,
    repoMonthlyCapUsd: EnvSchema.REPO_MONTHLY_LLM_CAP_USD,
  },

  scan: {
    maxPages: EnvSchema.SCAN_MAX_PAGES,
    timeoutMs: EnvSchema.SCAN_TIMEOUT_MS,
  },

  /** Log a warning instead of crashing when an external service credential is missing. */
  requireGitHubApp(): boolean {
    return Boolean(this.github.appId && this.github.privateKey);
  },
};

/** Warn about missing optional credentials in dev so misconfiguration is visible. */
export function warnMissing(): string[] {
  const missing: string[] = [];
  if (!EnvSchema.GITHUB_APP_ID) missing.push('GITHUB_APP_ID');
  if (!EnvSchema.GITHUB_APP_PRIVATE_KEY) missing.push('GITHUB_APP_PRIVATE_KEY');
  if (!EnvSchema.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY');
  if (isDev && missing.length > 0) {
    console.warn(`[config] missing optional credentials: ${missing.join(', ')}`);
  }
  return missing;
}

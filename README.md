EAA auto-fix PR bot

Scan for a11y violations -> AI fix diff in a PR -> human approves -> re-scan gates merge.

GitHub App that closes the accessibility loop: Playwright + axe-core scanning,
deterministic + Claude-generated fixes scoped to detected rule IDs, PRs a human
merges, and a merge-triggered re-scan that blocks regressions. The bot token has
no merge permission — ever.

## Stack

- Node ≥ 22, TypeScript (ESM), Express
- Playwright + axe-core for scanning (headless Chromium)
- Claude (Sonnet for semantic fixes, Haiku for low-value ones) via Anthropic SDK
- Octokit (GitHub App webhooks + REST), BullMQ on Redis for queues
- Postgres for state (schema in `db/schema.sql`), Stripe for metered billing
- Vitest, ESLint, Prettier; CI in `.github/workflows/ci.yml`

## Quickstart

```bash
npm install
docker compose up -d          # Postgres 16 + Redis 7, applies db/schema.sql
copy .env.example .env        # fill in what you have; server warns on missing
npm run dev                   # http://localhost:3000
```

Without `GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY` the webhook routes are
disabled and the app still serves the landing page + demo scan. Without
`STRIPE_SECRET_KEY` the Stripe client is a no-op. See `.env.example` for all
settings (LLM cost caps, scan limits, Stripe meters).

## Commands

```bash
npm run dev        # tsx watch
npm run build      # tsc -> dist/
npm start          # node dist/index.js
npm test           # vitest run (78 tests)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint src test
npm run format     # prettier
```

## Layout

- `src/server.ts`, `src/index.ts` — Express app, webhook receiver, workers boot.
- `src/scanner/` — Playwright+axe runner, page-content sanitizer (prompt-injection defense), visual diff.
- `src/fixer/` — deterministic Tier-1 fixes, Claude patch generation, patch validator (every hunk must map to a detected rule ID).
- `src/prbot.ts` — branch/PR creation, before/after axe summary in PR body.
- `src/workers/` — BullMQ workers: scan, fix, re-scan; file locator.
- `src/billing/` — Stripe metered billing (`usage.ts` enforces LLM spend ≤ 20% of revenue), best-effort usage events.
- `src/demo/` — landing-page demo scan: SSRF-guarded URL validation (`safeUrl.ts`) + scan endpoint.
- `src/db/` — pg pool + repositories.
- `landing/` — landing page with two demo modes (vendored axe-core 4.13.0, no CDN).
- `test/` — unit + golden-case tests (billing, patch validation, deterministic fixes, visual diff, sanitizer, PR bot, audit export, demo scan).
- `db/schema.sql` — Postgres schema; `docker-compose.yml` mounts it.

## Landing page + live demo

The conversion hook lives in `landing/` and has two demo modes (see ADR 006):

1. **Broken sample** — an intentionally inaccessible page rendered in a sandboxed iframe; axe-core is injected client-side and runs entirely in your browser.
2. **Scan your own URL** — `POST /api/demo-scan` runs the production scanner (headless Chromium + axe-core) against any public URL the visitor names; SSRF-guarded (http/https only, internal hosts/IPs refused pre- and post-DNS) and rate-limited (10/IP/hour).

Files:

- `landing/index.html` — EAA wedge copy, pricing, and the two-mode demo.
- `landing/assets/app.js` — sample-mode axe injection + URL-mode fetch client.
- `landing/assets/axe.min.js` — vendored axe-core 4.13.0 (no CDN dependency).
- `src/demo/safeUrl.ts` + `src/demo/scan.ts` — server-side URL validation and the demo scan itself.

The app serves the folder itself (`express.static(landing/)`), so run it and open `http://localhost:3000`:

```bash
npm run dev
```

## Billing

Metered billing via Stripe (ADR 003): base subscription + per merged fix + per page scanned
above quota. Two meters are configured in the Stripe dashboard
(`STRIPE_METER_FIXES`, `STRIPE_METER_PAGES`). Usage events are emitted best-effort
from the workers on scan and on PR merge, so billing never blocks the fix pipeline.
Pure cost/margin math lives in `src/billing/usage.ts` (enforces LLM spend ≤ 20% of
revenue) and is unit-tested; the Stripe client in `src/billing/stripe.ts` is a no-op
when `STRIPE_SECRET_KEY` is absent.

## Design docs

- `ARCHITECTURE.md` — components, data flow, security model, failure modes.
- `DECISIONS.md` — ADRs (billing meters, demo modes, fix tiers).
- `PRD.md`, `PROJECT_BIBLE.md` — product requirements and positioning.
- `RULES.md`, `TASKS.md` — working rules and task tracker.

## Market context

**Pain:** Monitoring vendors (Siteimprove, Pope Tech) report but don't fix; agency remediation costs $200-500/page; overlay "fixes" (accessiBe, UserWay) inject a runtime widget instead of fixing source code and face sustained industry backlash; automated scanners (axe-core) catch only ~30-40% of WCAG issues and leave the rest as raw rule IDs nobody in the repo owns.

**Buyer:** EU engineering lead or agency dev at an in-scope company (>10 employees or >€2M turnover selling into the EU — micro-enterprise services are exempt). Wants a fix-in-PR loop with diffs they can merge, not a dashboard. Secondary: German e-commerce operators already receiving Abmahnung warning letters.

**Competitors:** Evinced Autopilot (enterprise CI/CD, sales-led, no public pricing), Deque axe AI (AI triage, less PR-native), accessiBe/UserWay (widget-only, anti-positioning target), manual agency fixes ($200-500/page, weeks of turnaround). Wedge = scan -> AI fix -> PR w/ diff -> human approve -> re-scan gate on merge. Code-level fixes in the customer's repo, zero runtime overlay, EAA/EN 301 549 audit trail.

**2026 signal:** EAA enforcement began June 28, 2025. First French civil-society lawsuits filed Nov 2025; June 2026 Carrefour France court order (6 months to comply, penalty per day of delay); Sweden's PTS opened e-commerce cases on 124 complaints; Dutch ACM targeting active enforcement H2 2026 incl. non-EU companies. Enforcement is litigation-driven, which means legal-risk budget, not audit budget.

**Compliance anchors:** EAA (EU)/BFSG (DE), WCAG 2.2 AA baseline, EN 301 549 v3.2.1, VPAT/ACR export.

## Status

- [ ] Validated (20-message outreach in progress, see `outreach/`)
- [x] MVP built
- [x] Stripe metered billing wired (charge from day 1)
- [ ] First paying customer

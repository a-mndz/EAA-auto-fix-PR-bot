# Actionable Tasks: EAA auto-fix PR bot: scan -> AI Axe-rule fix -> human approves

`75c-eaa-autofix-pr-bot`

---

## Phase 1: Validation (Week 1-2)

- [x] 1-page landing w/ EAA compliance wedge + live axe scan demo on prospect URL
- [ ] 20 cold outreach messages (kill criterion: <5/20 replies from EU site owners)
- [ ] Competitive intel: Evinced Autopilot pricing/positioning, Deque axe AI mid-market presence
- [ ] 5-10 discovery interviews w/ in-scope EU companies or agencies
- [ ] 10 paying pilot commitments

---

## Phase 2: MVP (Week 3-4)

- [ ] GitHub App scaffold (octokit/Probot) + webhook receiver
- [ ] Scan worker: Playwright headless + axe-core; violation JSON output
- [ ] Postgres schema: Installations, Repos, Scans, Violations, FixPRs, AuditLog, Billing
- [ ] Redis/BullMQ queues (scan, fix, re-scan) + per-repo rate limits
- [ ] Fix generator: Claude Sonnet for semantic fixes; patch validator (hunk -> rule ID)
- [ ] Diff generator + fix branch creation + PR with before/after comment
- [ ] Human approval gate (no merge permission structurally; PR review only)
- [ ] Re-scan on merge -> GitHub check status + regression alert

---

## Phase 3: Billing / Eval / Security (Week 5-6)

- [ ] Stripe checkout + metered billing (per merged fix + per page above quota)
- [ ] Per-repo monthly LLM token cap + circuit breaker + cost dashboard
- [ ] Golden-case fixture set (known violations -> expected fixes) in CI
- [ ] Prompt-injection defense: scraped content sanitized before LLM context
- [ ] Screenshot diff in PR comments (visual-regression guard)
- [ ] EAA audit evidence export (scan history + fix log per repo)

---

## Phase 4: Launch + Iteration (Week 7+)

- [ ] Deploy staging + prod (Railway or AWS); GitHub Marketplace listing
- [ ] Onboard 10 pilots; measure fix acceptance rate daily
- [ ] German-market angle: Abmahnung-focused outreach
- [ ] Track: fix acceptance rate >= 60%, churn < 5%/mo, LLM cost <= 20% of revenue

---

## Distribution Channels (week 1)

- EU dev communities on HN/X; GitHub Marketplace; WCAG consultancy partnerships (they audit, we remediate); German legal-risk angle.

---

## Change Log

- **2026-08-16:** Landing page complete: two-mode demo (in-browser broken sample + server-side scan on any prospect URL via `/api/demo-scan`, SSRF-guarded + rate-limited). Dogfood axe scan of the landing returned 0 violations on the product surfaces. ADR 006 added.

- **2026-08-16:** Refined all docs from research: Evinced Autopilot (July 2026) added as direct competitor; EAA enforcement timeline updated (Carrefour judgment, Abmahnung wave, Dutch H2-2026 enforcement).

# Product Requirements Document (PRD)

## Project: EAA auto-fix PR bot: scan -> AI Axe-rule fix -> human approves (`75c-eaa-autofix-pr-bot`)

---

## 1. Product Objectives & Scope

### Goals
- Ship MVP within **4-5w** at ~10 hrs/wk founder time.
- Reach 10 paying customers in early validation phase.
- Hold LLM cost to <= 20% of customer revenue per unit.
- Position vs. Evinced Autopilot (July 2026 launch) and Deque by targeting the mid-market EAA segment that enterprise suites price out.

### Non-Goals
- Widget/overlay injection — fixes must be committed source code changes.
- Anything outside the EAA compliance wedge (no ADA/Section 508 marketing in v1).
- Custom integrations not on Stripe / standard APIs / MCP.
- Auto-merge under any configuration.

---

## 2. User Stories & Workflows

### Persona 1: Buyer / Decision-Maker — EU engineering lead
- **As an** EU eng lead at a company in EAA scope (>10 employees or >€2M revenue, selling services to EU consumers), **I want to** see a before/after axe scan and a diff ready to merge in week 1, **so that** compliance becomes engineering work, not legal exposure.
- **Acceptance:** Dashboard shows violation count trend, fixes merged, and per-repo compliance delta since install.

### Persona 2: End User — Developer reviewing PRs
- **As a** developer, **I want to** review AI-generated fix diffs in the normal PR review flow, with before/after axe results in the PR comment, **so that** I approve only what's safe.
- **Acceptance:** Fix PRs are scoped to detected axe rule IDs only; re-scan runs before merge; merge requires human approval.

---

## 3. Key Functional Requirements

### MVP Features
1. Axe-core scan via headless Playwright -> AI-generated fix diff scoped to violations
2. Fix PR with diff comment + before/after scan results
3. Human approval gate (GitHub PR review; bot has zero merge permissions)
4. Re-scan on merge -> regression detection vs. baseline violation count

### Post-MVP
1. WCAG 2.2 manual checklist + VPAT/ACR export for audit evidence.
2. Multi-repo portfolio dashboard for agencies.
3. EN 301 549 v3.2.1 report export mapped to EAA audit requirements.
4. Eval regression suite in CI w/ golden cases.

---

## 4. Non-Functional Requirements

- **Performance:** Full-page axe scan < 2 min/URL; PR comment posted within 5 min of scan; streamed progress for large crawls.
- **Reliability:** 99.9% uptime target w/ retries + DLQ on scan queue.
- **Security:** Bot GitHub token scoped to contents:write on target branches only, merge:never. TLS 1.3 in transit, AES-256 at rest, no customer source code persisted beyond scan session.
- **Compliance:** EAA (EU)/BFSG (DE), WCAG 2.2 AA, EN 301 549 v3.2.1, VPAT/ACR export (post-MVP).

---

## 5. Key Metrics & Success Criteria

- Conversion: >= 5% landing -> trial.
- Churn: < 5% monthly.
- Fix acceptance rate: >= 60% of generated fix PRs approved and merged (quality metric).
- LLM margin: cost <= 20% of customer revenue.
- Eval pass rate: 100% of golden cases before each release.

---

## 6. Failure Modes (must not regress)

- Auto-fix breaks other a11y rules → before/after axe run on every fix PR; new violations block the PR comment.
- Auto-merge bypasses review → bot token structurally lacks merge permission; approval gate enforced at API level too.
- Fix breaks visual layout → screenshot diff in PR comment; user must visually confirm.
- LLM-generated diff goes out of scope → every diff hunk validated against a detected axe rule ID; out-of-scope hunks rejected by pipeline.

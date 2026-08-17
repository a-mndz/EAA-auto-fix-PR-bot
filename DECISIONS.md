# Architectural Decision Records: EAA auto-fix PR bot: scan -> AI Axe-rule fix -> human approves

`75c-eaa-autofix-pr-bot`

---

## ADR 001: Stack Selection

**Status:** Accepted

**Context:** Need rapid deploy for 4-5w MVP at solo-founder velocity. Monitoring vendors report but don't fix; agency remediation costs $200-500/page; overlays (accessiBe) don't touch source code; Evinced's agentic tools (July 2026) target enterprise. Axe-core is the open-source detection standard.

**Decision:** GitHub App + Playwright/axe-core scanner + Claude Sonnet for remediation + PR bot. Diff generator validates every hunk against a detected rule ID.

**Consequences:** Fast velocity, zero frontend burden (GitHub is the UI). Trade-off: GitHub-only workflow; non-GitHub enterprises (GitLab/Azure DevOps) excluded until post-MVP.

---

## ADR 002: Model & Provider Strategy

**Status:** Accepted

**Context:** Cost + lock-in risk on any single LLM vendor. Fix generation varies in difficulty: trivial deterministic fixes don't need an LLM at all.

**Decision:**
- Tier 0 (no LLM): deterministic regex/AST transforms for safe mechanical fixes (lang attr, decorator alt, viewport meta).
- Primary reasoning: Claude Sonnet for semantic/structural fixes.
- Triage: Haiku for low-stakes generation (alt-text from image context).
- Unified gateway w/ automatic retry + fallback; per-repo monthly token hard cap.

**Consequences:** Most fixes are near-zero cost; margin defensible. Vendor swap kept viable via gateway.

---

## ADR 003: Pricing Architecture

**Status:** Accepted

**Context:** 2026 norm = per-outcome, not seat. Buyer anchors on $200-500/page agency remediation. EAA risk (litigation-driven since Carrefour June 2026) sustains recurring spend.

**Decision:**
- Hybrid: $39-79/mo base subscription + per merged fix meter (Stripe metered billing).
- Free tier: 1 repo, scan-only, no fixes â€” landing page demo hook.
- Token cost hard-cap at 20% of customer unit revenue.

**Consequences:** Buyer risk low; outcome price undercuts agency remediation 10x+; revenue scales with value delivered.

---

## ADR 004: Security: bot can propose, never merge

**Status:** Accepted

**Context:** Core trust requirement â€” an auto-fix bot writing to customer repos. Auto-merge is the top fear objection in any sales conversation.

**Decision:**
- GitHub App token granted `contents:write` and `pull_requests:write` only; merge permission structurally impossible.
- All fixes land via PR requiring human review; merge blocked until re-scan check passes.
- Audit log of every scan/fix for EAA evidence artifacts.
- Customer source code fetched per-fix and never persisted beyond the session.

**Consequences:** Enterprise trust; "bot can't merge" becomes a marketing line; audit log doubles as a compliance artifact.

---

## ADR 005: Eval-First Quality Bar

**Status:** Accepted

**Context:** Fix quality is the product. One bad fix that breaks layout burns trust faster than any competitor.

**Decision:**
- Golden-case fixture pages (known violations -> expected fix) gate every release.
- Every prod fix PR records before/after axe delta + screenshot diff; regression flags an alert.
- Failure-mode regression tests: fix introduces new violation; merge without approval; layout break; out-of-scope diff hunk.

**Consequences:** Quality regressions caught before customers see them; golden set becomes a proprietary asset as it grows.

---

## ADR 006: Public demo scan endpoint

**Status:** Accepted (2026-08-16)

**Context:** The Phase 1 validation wedge is a live axe scan "on prospect URL" on the landing page. Browsers cannot scan cross-origin sites (iframe same-origin), so the scan must run server-side. A public endpoint that fetches arbitrary user-supplied URLs is an SSRF + abuse surface.

**Decision:**
- `POST /api/demo-scan` reuses the production scanner (headless Chromium + axe-core), single page, 30s timeout, max 12 violations reported impact-sorted.
- SSRF guard chain: URL validation (http/https only, length cap, internal hostnames refused) → IP-literal range checks (IPv4 private/loopback/link-local/CGNAT/reserved; IPv6 ULA/link-local/multicast; IPv4-mapped IPv6 family refused outright because WHATWG URL normalizes it to hex) → DNS resolution gate (refuse if any resolved address is internal).
- Rate limit: 10 scans / IP / 60s fixed window, in-process.
- Landing page gains a two-mode demo: in-browser sample scan (unchanged) + "Scan your own URL" mode posting to this endpoint.
- Accepted residual risk: DNS rebinding between the gate check and Chromium's fetch is theoretically possible; acceptable at demo tier. Postpone proxy-isolated egress until launch traffic justifies it.

**Consequences:** Landing page satisfies the literal Phase 1 task (scan on prospect URL). No DB, no Redis, no auth needed for the demo path. Guard logic is unit-tested (14 cases). Rebind-hardening goes on the Phase 4 launch checklist.

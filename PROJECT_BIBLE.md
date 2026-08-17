# Project Bible: EAA auto-fix PR bot: scan -> AI Axe-rule fix -> human approves

## 1. Executive Summary & Vision

**Project ID:** `75c-eaa-autofix-pr-bot`
**Category:** EAA Compliance
**Strategic Goal:** Ship a 4-5w MVP that charges from day 1 and hits $5K-10K MRR by week 12.

### Product Vision
A GitHub App that scans for accessibility violations, generates scoped fix diffs, and opens PRs for human review — turning EAA compliance from legal exposure into routine engineering work.

**Why now (2026).** EAA enforcement began June 2025. First French civil-society lawsuits (Nov 2025); Carrefour France court-ordered remediation (June 2026); Sweden opened e-commerce cases; Netherlands targeting active enforcement H2 2026. Enforcement is litigation-driven, which converts compliance into legal-risk budget — recurring, not one-time.

---

## 2. Core Market Problem & Opportunity

### The Problem
Monitoring tools (Siteimprove, Pope Tech) report violations but leave remediation to humans; agency fixes cost $200-500/page with weeks of turnaround; overlays (accessiBe, UserWay) inject runtime widgets instead of fixing source and face sustained a11y-community backlash; axe-core catches violations but leaves raw rule IDs nobody owns in the repo.

### Market Opportunity
EAA applies to any business with >10 employees or >€2M turnover selling into the EU — a massive mid-market segment that enterprise suites (Evinced Autopilot, Deque axe AI) price out. WCAG 2.2 AA + EN 301 549 are the technical baselines buyers cite in procurement.

---

## 3. Target Audience & Customer Personas

- **Primary Buyer:** EU engineering lead at in-scope company; or agency dev maintaining client sites under EAA exposure.
- **End User:** Developer reviewing the fix PRs in the normal GitHub review flow.
- **Secondary:** German e-commerce operators already receiving Abmahnung (private warning-letter) campaigns — fastest conversion path.

---

## 4. Value Proposition & Competitive Moat

- **vs. Evinced Autopilot/Harness/Resolve (July 2026):** mid-market pricing; PR-native; no enterprise sales cycle.
- **vs. accessiBe/UserWay overlays:** actual source-code fixes, zero runtime injection, defensible against overlay backlash.
- **vs. manual agency fixes:** $0 marginal cost per fix vs. $200-500/page; turnaround in hours not weeks.
- **Moat:** golden-case eval set grows with each fix category; audit log doubles as EAA compliance artifact.

---

## 5. Business & Pricing Model

- **Base:** $39-79/mo (repos + pages-in-quota) — anchored against $200-500/page agency remediation.
- **Metered:** per merged fix (Stripe metered billing) + per page scanned above quota.
- **Free tier:** 1 repo, scan-only, no fixes — conversion hook for landing page demo.
- **Margin target:** >= 80% gross; LLM cost <= 20% of unit revenue; Tier-0 deterministic fixes carry zero LLM cost.

---

## 6. Technology Stack & Boundaries

- **Stack:** GitHub App (octokit/Probot) + Playwright/axe-core scanner + Claude Sonnet remediation + diff validator + PR bot.
- **Boundary:** GitHub-only in MVP; no GitLab/Azure DevOps until post-MVP. No widget/overlay features ever.
- **Eval harness:** golden-case fixture pages versioned in CI; before/after axe delta on every prod fix.

---

## 7. Regulatory & Compliance Alignment

- **EAA (EU)** Directive 2019/882; enforcement since June 28, 2025
- **BFSG (DE)** — German transposition, driving Abmahnung wave
- **WCAG 2.2 AA** as technical baseline (EN 301 549 reference)
- **VPAT/ACR export** — post-MVP audit-evidence feature

- Bot can propose but never merge (structural permission boundary).
- Audit log of every scan/fix; customer code never persisted beyond fix session.

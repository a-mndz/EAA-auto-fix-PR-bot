# Project Memory & Context: EAA auto-fix PR bot: scan -> AI Axe-rule fix -> human approves

`75c-eaa-autofix-pr-bot`

---

## 1. Metadata & Status

- **Name:** EAA auto-fix PR bot: scan -> AI Axe-rule fix -> human approves
- **Directory:** `projects/75c-eaa-autofix-pr-bot`
- **Category:** EAA Compliance
- **Ratings:** Demand=H | Effort=M | Monetization=fast | Difficulty=Mid | Time=4-5w
- **Phase:** Validation prep -> MVP build

---

## 2. Active Focus

- Landing page DONE + verified (two-mode demo: in-browser sample + server-side prospect-URL scan, ADR 006). Outreach kit written in outreach/OUTREACH.md — sending is the human-gated step.
- Competitive intel on Evinced Autopilot pricing (launched July 2026 â€” direct threat to wedge).
- GitHub App scaffold + Playwright/axe-core scan worker as first build milestone.
- German-market angle: Abmahnung wave = fastest conversion path.

---

## 3. Strategic Learnings

- **Why now:** EAA enforcement live since June 28, 2025. Nov 2025: French civil-society lawsuits. June 2026: Carrefour France court-ordered remediation (6-month deadline, daily penalty). Sweden 124 complaints, e-commerce cases open. Dutch ACM active enforcement H2 2026 incl. non-EU companies. No regulator fines yet â€” enforcement is litigation-driven.
- **Pricing:** $39-79/mo + per merged fix. Anchor: agency remediation $200-500/page. Free tier = scan-only, no fixes (demo hook).
- **Compliance anchors:** EAA/BFSG (DE), WCAG 2.2 AA, EN 301 549 v3.2.1, VPAT/ACR export (post-MVP).
- **Stack:** GitHub App (octokit/Probot), Playwright + axe-core, Claude Sonnet fixes, patch validator, no merge permission ever.
- **Key design rule:** bot proposes via PR, human approves, re-scan gates merge. Trust line in sales: "structurally unable to merge."

---

## 4. Buyer & Distribution Notes

- Buyer: EU eng lead at in-scope company (>10 employees or >â‚¬2M turnover) or agency dev. Wants diffs, not dashboards.
- Competitors: Evinced Autopilot/Harness/Resolve (Jul 2026, enterprise), Deque axe AI, EvinceAI, accessiBe/UserWay overlays (from $59/mo, widget-only, community backlash), agency manual fixes.
- Wedge: mid-market EAA PR-native fixes; zero runtime overlay; code-level diffs with audit trail.
- Distribution: HN/X EU dev communities, GitHub Marketplace, WCAG consultancy partnerships, German Abmahnung fear.

---

## 5. Change Log

- **2026-08-03:** Initial 8 docs created from `make_project_folders` template.
- **2026-08-03:** Pass 1 refined via `refine_docs.py` w/ cluster defaults + project MVP / eval.
- **2026-08-03:** Pass 2 refined via `deep_spec.SPECIFIC_V2` â€” pain / buyer / competitors / distribution / eval / failure / stack per project.
- **2026-08-16:** Pass 3 research-driven refine: EAA enforcement facts updated (Carrefour ruling, Abmahnung, Dutch H2-2026); Evinced Autopilot added as direct competitor; architecture replaced generic agent template w/ actual GitHub App + Playwright/axe + PR bot pipeline; approval gate hardened (no merge permission); pricing anchored to remediation cost.
- **2026-08-16 (pm):** Landing page live-verified (78 tests green; demo-scan E2E incl. SSRF refusals + rate limit). Evinced intel confirmed: Autopilot/Harness/Resolve launched 2026-07-29 (Disability:IN), enterprise CI/CD + sales-led, no public pricing — mid-market self-serve wedge unclaimed. Deque axe DevTools $40-200/dev/mo, engagements $15K-250K/yr. 20-message outreach kit drafted (segments: DE Abmahnung, Nordics, NL ACM, general EU, consultancy partners), each message requires a real /api/demo-scan result before send.

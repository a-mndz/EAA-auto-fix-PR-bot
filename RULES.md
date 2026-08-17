# Development & Product Rules: EAA auto-fix PR bot: scan -> AI Axe-rule fix -> human approves

`75c-eaa-autofix-pr-bot`

---

## 1. Coding Standards

- **Strict types** (TS strict mode / Python type hints). No implicit any.
- **Lint + format** on pre-commit (ESLint/Prettier or Ruff/Black).
- **Clean separation:** API layer, business logic, ORM.
- **Docstrings** on every exported function/class.

---

## 2. LLM Guardrails & Token Economy

- **Tiered generation:** deterministic transforms first (no LLM); Haiku for low-stakes (alt text); Sonnet only for semantic/structural fixes.
- **Per-execution budget:** hard cap $0.05/fix; per-repo monthly token cap w/ circuit breaker + alert.
- **Patch scope validation:** every diff hunk must map to a detected axe rule ID; out-of-scope hunks rejected before PR.
- **Scraped page content is untrusted:** sanitize before LLM context (prompt-injection defense).
- **Zero-retention LLM endpoint** or equivalent for customer source code.

---

## 3. Security & Compliance

- **Secrets** in env or secrets manager only.
- **GitHub App token permissions:** contents:write + pull_requests:write only. No merge permission, ever.
- **Customer code not persisted** beyond fix session.
- **Audit log** for every scan and fix (timestamp, repo, rule IDs, model, tokens).
- **Compliance anchors:** EAA/BFSG, WCAG 2.2 AA, EN 301 549 v3.2.1, VPAT/ACR export (post-MVP).

---

## 4. Testing & Quality

- **Unit tests:** >= 80% coverage on patch validator + diff generator.
- **Golden cases:** fixture pages w/ known violations -> expected fixed output; gate every release.
- **Before/after scan** on every fix branch; new violations = PR blocked.
- **CI:** lint + type + unit + golden-case eval on every PR.

---

## 5. Project-Specific Eval Cases (release gate)

- Fix PR diff introduces zero new axe violations.
- Bot cannot merge (token permission + check requirement both enforced).
- Re-scan on merge detects and flags any regression vs. baseline.
- Every diff hunk maps to a detected axe rule ID.

---

## 6. Known Failure Modes (regression tests required)

- Auto-fix introduces new a11y violations.
- Auto-merge or merge without human approval.
- Fix breaks visual layout (screenshot diff must catch).
- LLM diff goes out of scope (validator must catch).

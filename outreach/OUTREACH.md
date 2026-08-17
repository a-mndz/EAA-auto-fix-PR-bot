# Cold Outreach Kit — 20 messages (Phase 1 validation)

Kill criterion: **<5 replies out of 20 = invalid wedge**, pivot or kill.

## Workflow (do this for every prospect)

1. Pick a target site from the lists below.
2. Run their URL through the live demo on the landing page (or `POST /api/demo-scan`).
   Note the real violation count + 1-2 specific rule IDs (e.g. `image-alt`, `label`).
3. Insert the real numbers into the message. Never send a claim you haven't measured.
4. Send. Log in the tracker at the bottom. Count replies within 7 days.

All messages: under 120 words, one ask, link to the live demo.

---

## Segment A — German e-commerce, Abmahnung angle (6)

**A1 — de shop, known Abmahnung wave**
Subject: `WCAG-Mängel auf {domain} — 2 Klicks, bevor ein Verband sie meldet`

> Hallo {name},
>
> ich habe {domain} gerade mit axe-core gescannt — das Ergebnis: {N}
> Barrierefreiheits-Verstöße, u.a. {rule1} und {rule2}. Seit der Abmahnwelle
> gegen Onlinehändler 2025/26 reicht genau das für eine kostenpflichtige Abmahnung.
>
> Wir bauen ein Tool, das daraus automatisch einen Fix-Pull-request macht —
> Ihr Team approved, wir dürfen nichts mergen.
>
> Selbst testen (kostet 10 Sekunden, keine Anmeldung): {landing-url}/#demo
>
> Wollen Sie die ersten Fix-PRs diese Woche als Pilot — kostenlos?
>
> {signature}

**A2 — de shop, BFSG enforcement framing**
Subject: `{domain} und das BFSG — was der Scan zeigt`

> Hallo {name},
>
> seit dem 28.6.2025 gilt das BFSG für Ihren Shop. Ein axe-core-Scan von
> {domain} liefert aktuell {N} Verstöße — die häufigsten: {rule1}, {rule2}.
>
> Unser GitHub-App scannt, öffnet Fix-PRs, und Ihr Team entscheidet. Kein Overlay,
> keine Dashboard-Miete ohne Ergebnis. Den eigenen Scan können Sie hier live ansehen:
> {landing-url}/#demo
>
> Interesse an einem Pilot?
>
> {signature}

**A3 — marketplace seller / brand shop**
Subject: `Kurz gefragt: a11y-Fixes in Ihrem Repo?`

> Hallo {name}, ich sah, dass Sie {tech signal: GitHub org / Shopify / own repo}.
>
> Wir fixen WCAG-Verstöße direkt als Pull Request im Repo — kein Widget, kein
> Overlay. Scannen Sie {domain} selbst auf {landing-url}/#demo und schauen Sie,
> was eine PR bei Ihnen angehen würde.
>
> Würde Sie ein Pilot (kostenlos, 1 Repo) interessieren?
>
> {signature}

**A4 — German SaaS (in scope, >10 MA)**
Subject: `{N} Accessibility-Verstöße auf {domain}`

> Hallo {name},
>
> kurzer Scan Ihrer Startseite ergab {N} axe-core-Verstöße ({rule1}, {rule2}).
> Da Sie B2B an EU-Kunden verkaufen, greift die EAA — und Kundenanfragen zur
> Barrierefreiheit kommen spätestens mit den VPAT-Anforderungen Ihrer Käufer.
>
> Unser Fix: geprüfte PRs statt Audit-PDF. Live-Demo: {landing-url}/#demo
>
> Pilot diese Woche?
>
> {signature}

**A5 — German agency (they remediate for clients)**
Subject: `Partneranfrage: Accessibility-Remediation für Ihre Kunden`

> Hallo {name},
>
> Sie bauen/führen {agency clients}. Wir liefern Accessibility-Fixes als PRs —
> Ihre Devs reviewen, wir mergen nie. Für Agenturen heißt das: statt
> 200–500 €/Seite manueller Nacharbeit ein wiederkehrendes Tool mit Audit-Trail
> für jede Kundenfreigabe.
>
> Demo auf {landing-url}/#demo — testen Sie es an einer Kundenseite.
>
> 15 Minuten Call?
>
> {signature}

**A6 — German comparison: monitoring tool user**
Subject: `Ihr Monitoring meldet — wer fixt?`

> Hallo {name}, ich vermute, Sie nutzen bereits ein a11y-Monitoring
> ({signal: Siteimprove/Pope Tech badge}). Die Dashboards kennen das Problem:
> die Report-Liste wächst, niemand fixt.
>
> Wir setzen genau da an: Verstoß gefunden → Fix als PR im Repo → Ihr Review.
> Scan-Beispiel für {domain}: {N} Verstöße. Selbst testen: {landing-url}/#demo
>
> Pilot-Interesse?
>
> {signature}

---

## Segment B — Nordic e-commerce (Sweden: 124 complaints; Denmark/Finland) (4)

**B1 — Swedish e-commerce, PTS complaints angle**
Subject: `Your site, the PTS complaint wave, and one scan`

> Hi {name},
>
> Sweden's PTS has 124 open accessibility cases and more e-commerce complaints
> are coming. I ran an axe-core scan on {domain}: {N} violations — mostly
> {rule1} and {rule2}.
>
> We turn those into reviewed PRs instead of audit PDFs. Scan your own page
> live: {landing-url}/#demo
>
> Want the first fix PRs free this week?
>
> {signature}

**B2 — Nordic SaaS selling into EU**
Subject: `EAA exposure for {company}`

> Hi {name}, {company} sells into the EU, so the European Accessibility Act
> applies. Our scan of {domain} found {N} axe-core violations.
>
> We're a GitHub App that opens fix PRs scoped to those exact rule IDs — your
> team approves, we can't merge by design. Try the live scan: {landing-url}/#demo
>
> Care to pilot on one repo?
>
> {signature}

**B3 — Danish/Norwegian e-commerce (EU-wide EAA)**
Subject: `{domain}: {N} accessibility issues found`

> Hi {name}, quick scan of {domain} via axe-core: {N} violations
> ({rule1}, {rule2}). The EAA covers you selling into the EU, and Nordic
> enforcement is ramping up.
>
> We fix these as pull requests — human-approved, no overlays. See your own
> scan live: {landing-url}/#demo
>
> Free pilot for one repo — interested?
>
> {signature}

**B4 — Nordic agency**
Subject: `Accessibility remediation as a service layer for your clients`

> Hi {name},
>
> Your agency remediates client sites — usually $200–500/page, manually.
> We ship the fixes as PRs with an audit trail per change, and a human
> (you) stays in the loop.
>
> Try it on a client staging URL: {landing-url}/#demo
>
> Open to a 15-min call about a partnership?
>
> {signature}

---

## Segment C — Netherlands (ACM enforcement H2 2026, incl. non-EU sellers) (4)

**C1 — Dutch e-commerce, ACM angle**
Subject: `ACM gaat handhaven: wat een scan van {domain} laat zien`

> Hallo {name},
>
> De ACM begint in H2 2026 met actieve handhaving van de EAA — ook voor
> bedrijven buiten de EU die hier verkopen. Een axe-core-scan van {domain}
> toont {N} overtredingen, vooral {rule1} en {rule2}.
>
> Wij zetten die om in pull-requests: codefixes die jullie zelf goedkeuren,
> geen overlay. Test de live scan: {landing-url}/#demo
>
> Gratis pilot deze week?
>
> {signature}

**C2 — Dutch SaaS/marketing agency**
Subject: `EAA-readiness voor jullie klanten, zonder audit-PDF`

> Hallo {name},
>
> Jullie klanten krijgen straks EAA-vragen. In plaats van rapporten leveren
> wij fix-PRs met audittrail — jullie developers keuren goed.
>
> Scan een klantsite live op {landing-url}/#demo. Zullen we 15 minuten bellen?
>
> {signature}

**C3 — Dutch shop, practical framing**
Subject: `{N} toegankelijkheidsproblemen op {domain}`

> Hallo {name},
>
> Korte scan van {domain}: {N} WCAG-problemen ({rule1}, {rule2}). Geen paniek —
> maar de handhaving komt eraan. Wij fixen dit als pull-requests in jullie repo.
>
> Live demo (scan jullie eigen URL): {landing-url}/#demo
> Pilot interest?
>
> {signature}

**C4 — Non-EU seller into NL (ACM covers them too)**
Subject: `Selling to Dutch customers? The EAA applies to you`

> Hi {name}, the Dutch ACM explicitly includes non-EU companies selling into
> the Netherlands in its H2-2026 EAA enforcement. We scanned {domain}:
> {N} violations, e.g. {rule1}.
>
> We open fix PRs scoped to those rule IDs — you approve, we never merge.
> Scan your page live: {landing-url}/#demo
>
> Pilot on one repo?
>
> {signature}

---

## Segment D — General EU e-commerce / SaaS (3)

**D1 — EU e-commerce, litigation framing**
Subject: `Carrefour got a court order in June. Yours is {N} violations away.`

> Hi {name}, in June 2026 a French court ordered Carrefour to fix its
> sites within 6 months or pay per-day penalties. I scanned {domain}:
> {N} axe-core violations ({rule1}, {rule2}) — the same evidence pattern
> those suits use.
>
> We turn the list into reviewed PRs. Scan your own site live:
> {landing-url}/#demo
>
> Free pilot this week?
>
> {signature}

**D2 — EU SaaS with public repo**
Subject: `Fixing your README's accessibility claims`

> Hi {name}, I saw {company}'s repo on GitHub. We built the tool I wish
> existed: axe-core findings → scoped fix PRs → your review. No merge
> permission for the bot, ever.
>
> Your landing page scans at {N} violations — see it yourself:
> {landing-url}/#demo
>
> Want to pilot it on one repo?
>
> {signature}

**D3 — EU online retail, plain-language**
Subject: `Accessibility report for {domain} (auto-generated)`

> Hi {name}, I ran our production scanner on {domain}: {N} accessibility
> violations. Report highlights: {rule1} ({count1}), {rule2} ({count2}).
>
> If your repo is on GitHub, we can turn these into fix PRs this week —
> you approve every diff. Live scan: {landing-url}/#demo
>
> Interested in a free pilot?
>
> {signature}

---

## Segment E — WCAG consultancies (partnership: they audit, we remediate) (3)

**E1 — Established a11y consultancy**
Subject: `Your audits, our PR pipeline`

> Hi {name}, your team audits; remediation is where client budgets stall.
> We convert axe reports into scoped fix PRs with an audit trail — your
> consultants review, the client's devs merge. Recurring revenue per client
> repo without you staffing the fixes.
>
> Try the scanner: {landing-url}/#demo
>
> 15 minutes to explore a partnership?
>
> {signature}

**E2 — Freelance a11y consultant (DE/NL)**
Subject: `Mehr Durchsatz pro Audit`

> Hallo {name},
>
> Sie auditieren, wir produzieren die Fix-PRs — mit Audittrail für jede
> Änderung. Statt 200–500 €/Seite manuell übernehmen Sie Remediation als
> wiederkehrende Leistung.
>
> Scanner testen: {landing-url}/#demo
> Kurzer Call?
>
> {signature}

**E3 — Dev agency with a11y offering**
Subject: `Ship the audit AND the fix`

> Hi {name}, agencies sell audits; clients delay the fix. With our GitHub
> App, your audit becomes PRs the same day — your team reviews them, and
> the client sees progress in their own repo.
>
> Test it on a client staging URL: {landing-url}/#demo
>
> Open to a call?
>
> {signature}

---

## Where to find the 20 recipients

| Segment | Source | Target count |
|---|---|---|
| A | Abmahnung case reports (e.g. Händlerbund, IT-Recht Kanzlei blog lists), German Shopify stores w/ staff >10 | 6 |
| B | Swedish e-commerce association (E-handel Sverige) member list; Nordic Shopify top lists | 4 |
| C | Dutch Thuiswinkel.org member list | 4 |
| D | EU e-commerce award nominees; EU SaaS w/ public GitHub org | 3 |
| E | IAAP member directory, a11y Slack/LinkedIn practitioners, Deque partner list | 3 |

Personalization signals to look for: job title (CTO/Head of Engineering/Accessibility Lead),
public GitHub org, known monitoring tool badge, BFSG/VPAT page on their site, prior
Abmahnung mention in press.

---

## Reply tracker

Kill criterion: **5+ replies out of 20 within 14 days** or pivot.

| # | Sent | Segment | Recipient | Company/URL | Scanned (N) | Replied | Notes |
|---|---|---|---|---|---|---|---|
| A1 |  |  |  |  |  |  |  |
| A2 |  |  |  |  |  |  |  |
| A3 |  |  |  |  |  |  |  |
| A4 |  |  |  |  |  |  |  |
| A5 |  |  |  |  |  |  |  |
| A6 |  |  |  |  |  |  |  |
| B1 |  |  |  |  |  |  |  |
| B2 |  |  |  |  |  |  |  |
| B3 |  |  |  |  |  |  |  |
| B4 |  |  |  |  |  |  |  |
| C1 |  |  |  |  |  |  |  |
| C2 |  |  |  |  |  |  |  |
| C3 |  |  |  |  |  |  |  |
| C4 |  |  |  |  |  |  |  |
| D1 |  |  |  |  |  |  |  |
| D2 |  |  |  |  |  |  |  |
| D3 |  |  |  |  |  |  |  |
| E1 |  |  |  |  |  |  |  |
| E2 |  |  |  |  |  |  |  |
| E3 |  |  |  |  |  |  |  |
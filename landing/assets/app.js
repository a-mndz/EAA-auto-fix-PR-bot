// Live axe demo for the EAA Fix landing page.
// Two modes:
//  1. Sample page â€” an intentionally broken page rendered in a sandboxed
//     iframe; axe-core runs entirely in your browser.
//  2. Your URL â€” posted to /api/demo-scan, where the production scanner
//     (headless Chromium + axe-core) checks the page you name.
// Sample mode is local; URL mode sends one request to this site's server.

const SAMPLE_PAGE = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; padding: 16px; color: #bbb; background: #fff; }
    .muted { color: #ccc; font-size: 11px; }
    .tag { background: #eee; padding: 2px 6px; }
  </style>
</head>
<body>
  <h1>Acme Store</h1>
  <p class="muted">Summer sale now on. <a href="/sale">click here</a> to see deals.</p>

  <input type="text" placeholder="Search products" id="q1">

  <h3>Featured</h3>
  <img src="https://via.placeholder.com/120" >
  <button>Submit</button>

  <ul>
    <div class="tag">Free shipping over â‚¬50</div>
  </ul>
</body>
</html>`;

const FIX_HINTS = {
  'document-title': 'Add a descriptive <title> in the document <head>.',
  'html-has-lang': 'Add lang="en" (or the page language) to the <html> tag.',
  'image-alt': 'Add a meaningful alt="â€¦", or alt="" when the image is decorative.',
  'button-name': 'Give the button readable text or an aria-label.',
  'link-name': 'Replace vague text (e.g. â€œclick hereâ€) with descriptive link text.',
  label: 'Associate the input with a <label> or aria-label.',
  'heading-order': 'Fix skipped heading levels (h1 â†’ h2 â†’ h3, no jumps).',
  'color-contrast': 'Raise text/background contrast to at least 4.5:1 (AA).',
  'duplicate-id': 'Make every id attribute unique on the page.',
  list: 'Wrap list content in <li> elements inside the <ul>/<ol>.',
  listitem: 'Ensure each list item is an <li> within its parent list.',
};

const DEFAULT_HINT = 'Scoped patch to this axe rule only â€” no drive-by edits.';
const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];

let mode = 'sample';
let aborter = null;

function $(id) {
  return document.getElementById(id);
}

function setStatus(text) {
  const el = $('demo-status');
  if (el) el.textContent = text;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

function normalizeViolation(v) {
  if (v.ruleId) {
    // Server shape from /api/demo-scan.
    return {
      id: v.ruleId,
      impact: v.impact || 'minor',
      help: v.help,
      target: v.target,
      hint: FIX_HINTS[v.ruleId] || DEFAULT_HINT,
    };
  }
  // Browser shape from axe.run on the sample frame.
  const target =
    (v.nodes && v.nodes[0] && Array.isArray(v.nodes[0].target)
      ? v.nodes[0].target.join(' ')
      : '') || v.id;
  return {
    id: v.id,
    impact: v.impact || 'minor',
    help: v.help,
    target,
    hint: FIX_HINTS[v.id] || DEFAULT_HINT,
  };
}

function renderSummary(violations) {
  const summary = $('demo-summary');
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations) {
    const key = v.impact || 'minor';
    if (key in counts) counts[key] += 1;
  }
  summary.hidden = false;
  summary.innerHTML = '';

  const make = (cls, n, label) => {
    const d = document.createElement('div');
    d.className = `summary-pill ${cls}`;
    d.innerHTML = `<span class="n">${n}</span><span class="l">${label}</span>`;
    return d;
  };
  for (const imp of IMPACT_ORDER) {
    summary.appendChild(make(imp, counts[imp], imp));
  }
  if (violations.length === 0) {
    const pass = document.createElement('div');
    pass.className = 'summary-pill pass';
    pass.innerHTML = '<span class="n">0</span><span class="l">violations</span>';
    summary.appendChild(pass);
  }
}

function renderResults(violations, extraNote) {
  const list = $('demo-results');
  list.innerHTML = '';
  if (violations.length === 0) {
    const li = document.createElement('li');
    li.className = 'violation';
    li.innerHTML =
      '<div class="violation-help"><strong>No violations found.</strong> This page would pass axe-core.</div>';
    list.appendChild(li);
    return;
  }

  for (const v of violations) {
    const li = document.createElement('li');
    li.className = `violation impact-${v.impact}`;
    li.innerHTML = `
      <div class="violation-head">
        <span class="violation-rule">${escapeHtml(v.id)}</span>
        <span class="impact-tag ${v.impact}">${v.impact}</span>
      </div>
      <p class="violation-help">${escapeHtml(v.help)}</p>
      <code class="violation-target">${escapeHtml(v.target)}</code>
      <div class="violation-fix"><strong>Bot would fix</strong> â€” ${v.hint}</div>
    `;
    list.appendChild(li);
  }

  if (extraNote) {
    const li = document.createElement('li');
    li.className = 'violation-results-note';
    li.textContent = extraNote;
    list.appendChild(li);
  }
}

function runAxeInFrame(frame) {
  return new Promise((resolve, reject) => {
    const doc = frame.contentDocument;
    if (!doc) {
      reject(new Error('cannot access demo frame'));
      return;
    }
    if (doc.defaultView && doc.defaultView.axe) {
      runAxe(doc).then(resolve).catch(reject);
      return;
    }
    const script = doc.createElement('script');
    script.src = 'assets/axe.min.js';
    script.onload = () => runAxe(doc).then(resolve).catch(reject);
    script.onerror = () => reject(new Error('axe-core failed to load'));
    doc.head.appendChild(script);
  });
}

function runAxe(doc) {
  return doc.defaultView.axe.run(doc, {
    resultTypes: ['violations'],
  });
}

async function scanSample() {
  const frame = $('demo-frame');
  setStatus('Scanningâ€¦ axe-core is analysing the sample page in your browser.');
  const results = await runAxeInFrame(frame);
  const violations = results.violations.map(normalizeViolation);
  renderSummary(violations);
  renderResults(violations);
  const n = violations.length;
  setStatus(
    n === 0
      ? 'Clean â€” no violations detected.'
      : `Found ${n} violation${n === 1 ? '' : 's'}. A fix PR would target exactly these rule IDs.`,
  );
}

async function scanUrl(rawUrl) {
  setStatus('Scanningâ€¦ our headless browser is loading your page (up to 30s).');
  if (aborter) aborter.abort();
  aborter = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const controller = aborter;
  const timeout = setTimeout(() => controller && controller.abort(), 40_000);

  const res = await fetch('/api/demo-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: rawUrl }),
    signal: controller ? controller.signal : undefined,
  });
  clearTimeout(timeout);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body && body.error ? body.error : `scan failed (${res.status})`;
    throw new Error(msg);
  }
  const violations = (body.violations || []).map(normalizeViolation);
  renderSummary(violations);
  const note =
    body.violationCount > violations.length
      ? `Showing the ${violations.length} most impactful of ${body.violationCount} total violations.`
      : null;
  renderResults(violations, note);
  const title = body.title ? ` (â€œ${body.title}â€)` : '';
  setStatus(
    body.violationCount === 0
      ? `Clean â€” ${body.url}${title} passed axe-core.`
      : `Found ${body.violationCount} violation${body.violationCount === 1 ? '' : 's'} on your page. A fix PR would target exactly these rule IDs.`,
  );
}

function setBusy(busy) {
  $('scan-btn').disabled = busy;
  $('url-scan-btn').disabled = busy;
  $('url-input').disabled = busy;
}

function setMode(next) {
  mode = next;
  const frame = $('demo-frame');
  const frameLabel = document.querySelector('.demo-frame-label');
  const urlForm = $('url-form');

  for (const btn of document.querySelectorAll('.mode-btn')) {
    const active = btn.id === `mode-${next}`;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  }

  $('demo-summary').hidden = true;
  $('demo-results').innerHTML = '';

  if (next === 'sample') {
    frame.srcdoc = SAMPLE_PAGE;
    frame.removeAttribute('src');
    frameLabel.innerHTML =
      '<span class="dot dot-bad" aria-hidden="true"></span> Sample page (intentionally inaccessible)';
    urlForm.hidden = true;
    $('scan-btn-wrap').hidden = false;
    setStatus('Ready. Press â€œRun accessibility scanâ€.');
  } else {
    frame.removeAttribute('srcdoc');
    frameLabel.innerHTML =
      '<span class="dot dot-acc" aria-hidden="true"></span> Your page â€” enter a URL and scan';
    urlForm.hidden = false;
    $('scan-btn-wrap').hidden = true;
    setStatus('Enter your site URL â€” we run the production scanner on it.');
    $('url-input').focus();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const frame = $('demo-frame');
  frame.srcdoc = SAMPLE_PAGE;

  $('mode-sample').addEventListener('click', () => setMode('sample'));
  $('mode-url').addEventListener('click', () => setMode('url'));

  $('scan-btn').addEventListener('click', async () => {
    setBusy(true);
    try {
      await scanSample();
    } catch (err) {
      setStatus(`Demo unavailable: ${err.message}. Serve this folder over http and retry.`);
    } finally {
      setBusy(false);
    }
  });

  $('url-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = $('url-input').value.trim();
    if (!raw) return;
    // Optimistic preview; sites that refuse framing will show blank â€” fine.
    frame.src = raw.startsWith('http') ? raw : `https://${raw}`;
    setBusy(true);
    try {
      await scanUrl(raw);
    } catch (err) {
      setStatus(`Scan failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  });
});
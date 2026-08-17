/**
 * Tier-0 deterministic fixes: safe mechanical transforms, zero LLM cost.
 * Each handler maps an axe rule ID to a pure transform over file content.
 */

export interface DeterministicFixOutcome {
  ruleId: string;
  applied: boolean;
  reason: string;
  source: string;
}

type Handler = (source: string) => DeterministicFixOutcome;

function outcome(ruleId: string, source: string, applied: boolean, reason: string): DeterministicFixOutcome {
  return { ruleId, source, applied, reason };
}

const HANDLERS = new Map<string, Handler>();

/** html-has-lang: add lang to <html> when missing. */
HANDLERS.set('html-has-lang', (source) => {
  const match = source.match(/<html([^>]*)>/i);
  if (!match || /\blang\s*=/i.test(match[1] ?? '')) {
    return outcome('html-has-lang', source, false, 'lang attribute already present');
  }
  const next = source.replace(/<html([^>]*)>/i, '<html lang="en"$1>');
  return outcome('html-has-lang', next, next !== source, 'added lang="en" to <html>');
});

/** html-lang-valid: replace empty lang="" with a valid default. */
HANDLERS.set('html-lang-valid', (source) => {
  if (!/\blang\s*=\s*["']\s*["']/i.test(source)) {
    return outcome('html-lang-valid', source, false, 'no empty lang attribute found');
  }
  const next = source.replace(/\blang\s*=\s*["']\s*["']/i, 'lang="en"');
  return outcome('html-lang-valid', next, next !== source, 'replaced empty lang with lang="en"');
});

/** meta-viewport: user-scalable=no or maximum-scale<2 blocks zoom; widen both. */
HANDLERS.set('meta-viewport', (source) => {
  const metaRe = /<meta[^>]*name\s*=\s*["']viewport["'][^>]*>/i;
  const tag = source.match(metaRe)?.[0];
  if (!tag) return outcome('meta-viewport', source, false, 'no viewport meta found');
  const content = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
  if (content === undefined) {
    return outcome('meta-viewport', source, false, 'viewport meta has no content attribute');
  }
  const next = tag
    .replace(/user-scalable\s*=\s*(no|0)/gi, 'user-scalable=yes')
    .replace(/maximum-scale\s*=\s*([01](?:\.\d+)?)/gi, 'maximum-scale=5');
  if (next === tag) {
    return outcome('meta-viewport', source, false, 'viewport already permits zoom');
  }
  return outcome(
    'meta-viewport',
    source.replace(tag, next),
    true,
    'viewport meta now permits zoom',
  );
});

/**
 * image-alt: only applied to images that are clearly decorative
 * (aria-hidden / role=presentation / filename hint) and have no alt attribute.
 * Meaningful images without alt are routed to the LLM tier instead.
 */
HANDLERS.set('image-alt', (source) => {
  const imgRe = /<img\b([^>]*?)\/?>/gi;
  let changed = false;
  const next = source.replace(imgRe, (tag, attrs: string) => {
    if (/\balt\s*=/i.test(attrs)) return tag;
    const decorative =
      /\baria-hidden\s*=\s*["']true["']/i.test(attrs) ||
      /\brole\s*=\s*["']presentation["']/i.test(attrs) ||
      /\b(?:src|href)\s*=\s*["'][^"']*(?:decorative|divider|spacer|blank)\b/i.test(attrs);
    if (!decorative) return tag;
    changed = true;
    return tag.replace(/\s*\/?>$/, ' alt=""$&');
  });
  return outcome(
    'image-alt',
    next,
    changed,
    changed ? 'added alt="" to decorative images lacking alt' : 'no decorative img missing alt found',
  );
});

/** Apply deterministic handlers for the requested rules, chaining source through each. */
export function applyDeterministicFixes(
  source: string,
  ruleIds: string[],
): { source: string; outcomes: DeterministicFixOutcome[] } {
  let current = source;
  const outcomes: DeterministicFixOutcome[] = [];
  for (const ruleId of ruleIds) {
    const handler = HANDLERS.get(ruleId);
    if (!handler) {
      outcomes.push(outcome(ruleId, current, false, 'no deterministic handler'));
      continue;
    }
    const res = handler(current);
    current = res.source;
    outcomes.push(res);
  }
  return { source: current, outcomes };
}

export function hasDeterministicHandler(ruleId: string): boolean {
  return HANDLERS.has(ruleId);
}

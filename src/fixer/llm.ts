import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

export interface GenerateOptions {
  system: string;
  prompt: string;
  maxTokens: number;
  /** 'sonnet' for semantic/structural fixes, 'haiku' for low-stakes like alt text. */
  tier: 'sonnet' | 'haiku';
}

export interface GenerateResult {
  text: string;
  model: string;
  costUsd: number;
}

const PRICING_PER_MTOK = {
  sonnet: { input: 3, output: 15 },
  haiku: { input: 0.8, output: 4 },
} as const;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    if (!config.llm.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured; LLM tier unavailable');
    }
    client = new Anthropic({ apiKey: config.llm.apiKey });
  }
  return client;
}

/**
 * Single-shot completion with cost accounting + one retry on transient failure.
 * Cost is estimated from token usage; callers persist it for the per-repo cap.
 */
export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const model = opts.tier === 'sonnet' ? config.llm.sonnetModel : config.llm.haikuModel;
  const pricing = opts.tier === 'sonnet' ? PRICING_PER_MTOK.sonnet : PRICING_PER_MTOK.haiku;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await getClient().messages.create({
        model,
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: [{ role: 'user', content: opts.prompt }],
      });
      const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const inputTokens = resp.usage.input_tokens;
      const outputTokens = resp.usage.output_tokens;
      const costUsd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
      return { text, model, costUsd };
    } catch (err) {
      if (attempt === 1) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('unreachable');
}

// lib/anthropic.ts
import "server-only";
// USD per million tokens — platform.claude.com/docs/en/about-claude/pricing (tra 13/11/2026). Re-check before each release.
export const PRICES = {
  "claude-sonnet-5-5": { inPerM: 2, outPerM: 10, cacheReadPerM: 0.1, cacheWritePerM: 2.5 },
  "claude-haiku-5-5": { inPerM: 0.1, outPerM: 0.5, cacheReadPerM: 0.01, cacheWritePerM: 0.125 },
} as const;
type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

export function costUsd(model: string, u: Usage): number {
  const p = PRICES[model as keyof typeof PRICES];
  if (!p) throw new Error(`no price for ${model}`);
  const read = u.cache_read_input_tokens ?? 0;
  const write = u.cache_creation_input_tokens ?? 0;
  return (u.input_tokens * p.inPerM + read * p.cacheReadPerM + write * p.cacheWritePerM + u.output_tokens * p.outPerM) / 1_000_000;
}

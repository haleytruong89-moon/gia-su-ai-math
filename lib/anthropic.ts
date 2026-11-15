// lib/anthropic.ts
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ModelClient } from "@/lib/tutor/turn";
// USD per million tokens — platform.claude.com/docs/en/about-claude/pricing (tra 13/11/2026; Opus 15/11/2026). Re-check before each release.
export const PRICES = {
  "claude-opus-5-5": { inPerM: 4, outPerM: 20, cacheReadPerM: 0.2, cacheWritePerM: 5 }, // eval (G0) only
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

const retryable = (e: unknown) => {
  const status = (e as { status?: unknown } | null)?.status;
  return typeof status !== "number" || status >= 500; // network error, 5xx, 529 overloaded
};

/** One retry on a server error or overload (DOMAIN §5); a 4xx is our bug and is not retried. */
export function withRetry(client: ModelClient, waitMs = 800): ModelClient {
  return {
    async create(req) {
      try {
        return await client.create(req);
      } catch (e) {
        if (!retryable(e)) throw e;
        await new Promise((r) => setTimeout(r, waitMs));
        return client.create(req);
      }
    },
  };
}

/** The real Claude client (key from the tutor's own workspace, D19). Server only. */
export function realClient(apiKey: string): ModelClient {
  const sdk = new Anthropic({ apiKey, maxRetries: 0, timeout: 50_000 });
  return withRetry({ create: (req) => sdk.messages.create(req as never) as never });
}

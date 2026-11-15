// lib/tutor/turn.ts
import { costUsd } from "@/lib/anthropic";
import type { Msg, SystemBlock } from "@/lib/tutor/assemble";
import { parseTutorOutput, tutorOutputJsonSchema, type TutorOutput } from "@/lib/tutor/schema";

export interface ModelClient {
  create(req: object): Promise<{ content: { type: string; text?: string }[]; stop_reason?: string | null;
    usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } }>;
}

/**
 * Claude 5.5 models think by default (adaptive) and the thinking counts toward max_tokens, so a small
 * max_tokens cuts the JSON reply (G0 run 2, 15/11/2026: 900 tokens → most replies cut or empty).
 * Sonnet/Opus cannot turn thinking off; effort "medium" keeps it short. Length of the visible reply is
 * still bounded by max_lines in the prompt.
 */
export const MAX_OUTPUT_TOKENS = 8000;
export type Effort = "low" | "medium" | "high";

export async function runTutorTurn(client: ModelClient,
  req: { model: string; system: SystemBlock[]; messages: Msg[]; effort?: Effort }) {
  const res = await client.create({
    model: req.model, max_tokens: MAX_OUTPUT_TOKENS, system: req.system, messages: req.messages,
    output_config: { effort: req.effort ?? "medium", format: { type: "json_schema", schema: tutorOutputJsonSchema } },
  });
  const raw = res.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  const parsed = parseTutorOutput(raw);
  const cached = res.usage.cache_read_input_tokens ?? 0;
  return {
    output: parsed.ok ? (parsed.value as TutorOutput) : null,
    raw,
    stopReason: res.stop_reason ?? null,
    costUsd: costUsd(req.model, res.usage),
    tokens: { in: res.usage.input_tokens + cached + (res.usage.cache_creation_input_tokens ?? 0), cached, out: res.usage.output_tokens },
  };
}

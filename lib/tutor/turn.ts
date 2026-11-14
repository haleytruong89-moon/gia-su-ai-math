// lib/tutor/turn.ts
import { costUsd } from "@/lib/anthropic";
import type { Msg, SystemBlock } from "@/lib/tutor/assemble";
import { parseTutorOutput, tutorOutputJsonSchema, type TutorOutput } from "@/lib/tutor/schema";

export interface ModelClient {
  create(req: object): Promise<{ content: { type: string; text?: string }[];
    usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } }>;
}

export async function runTutorTurn(client: ModelClient, req: { model: string; system: SystemBlock[]; messages: Msg[] }) {
  const res = await client.create({
    model: req.model, max_tokens: 900, system: req.system, messages: req.messages,
    output_config: { format: { type: "json_schema", schema: tutorOutputJsonSchema } },
  });
  const raw = res.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  const parsed = parseTutorOutput(raw);
  const cached = res.usage.cache_read_input_tokens ?? 0;
  return {
    output: parsed.ok ? (parsed.value as TutorOutput) : null,
    raw,
    costUsd: costUsd(req.model, res.usage),
    tokens: { in: res.usage.input_tokens + cached, cached, out: res.usage.output_tokens },
  };
}

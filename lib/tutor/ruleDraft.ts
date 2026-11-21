// lib/tutor/ruleDraft.ts — Sonnet turns a parent's 👍/👎 note into one proposed teaching rule (G7b, P3).
// Never throws: on any problem the note stays stored and no rule is proposed.
import { z } from "zod";
import { costUsd } from "@/lib/anthropic";
import { RULE_MAX_CHARS } from "@/lib/rules/teachingRules";
import type { ModelClient } from "@/lib/tutor/turn";

export const ruleDraftJsonSchema = {
  type: "object",
  properties: { rule: { type: "string" }, skip: { type: "boolean" } },
  required: ["rule", "skip"],
  additionalProperties: false,
};
const answer = z.object({ rule: z.string(), skip: z.boolean() });

export interface DraftCall { model: string; raw: string; costUsd: number; tokens: { in: number; cached: number; out: number } }
export interface DraftInput { tutorText: string; childBefore: string | null; thumb: "up" | "down"; note: string }

export async function draftRule(client: ModelClient, d: { model: string; prompt: string }, input: DraftInput): Promise<{ text: string | null; call: DraftCall | null }> {
  const text = [
    `Bố mẹ bấm: ${input.thumb === "down" ? "👎 (cô nên dạy khác)" : "👍 (cô dạy tốt)"}`,
    `Ghi chú của bố mẹ: ${input.note}`,
    input.childBefore ? `Tin của con ngay trước lượt này:\n${input.childBefore}` : "Tin của con ngay trước lượt này: (không có)",
    `Lượt dạy của cô:\n${input.tutorText}`,
  ].join("\n\n");
  try {
    const res = await client.create({
      model: d.model, max_tokens: 2000,
      system: [{ type: "text", text: d.prompt }],
      messages: [{ role: "user", content: text }],
      output_config: { effort: "low", format: { type: "json_schema", schema: ruleDraftJsonSchema } },
    });
    const raw = res.content.filter((p) => p.type === "text").map((p) => p.text ?? "").join("");
    const cached = res.usage.cache_read_input_tokens ?? 0;
    const call: DraftCall = { model: d.model, raw, costUsd: costUsd(d.model, res.usage),
      tokens: { in: res.usage.input_tokens + cached + (res.usage.cache_creation_input_tokens ?? 0), cached, out: res.usage.output_tokens } };
    let a: z.infer<typeof answer>;
    try {
      a = answer.parse(JSON.parse(raw));
    } catch {
      return { text: null, call };
    }
    const rule = a.rule.trim().slice(0, RULE_MAX_CHARS).trim();
    return { text: a.skip || !rule ? null : rule, call };
  } catch (e) {
    console.error("rule draft call failed", e instanceof Error ? e.message : "unknown");
    return { text: null, call: null };
  }
}

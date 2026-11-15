// lib/tutor/guard.ts — checks every final tutor answer before the child sees it
// (prompts/guard.md = SYSTEM_PROMPT "Prompt bộ kiểm tra"). Fail-closed: when the checker cannot answer,
// the answer counts as not passed, so it is rewritten or replaced by a safe line (DOMAIN §5).
import { z } from "zod";
import { costUsd } from "@/lib/anthropic";
import type { HintLevel } from "@/lib/rules/hints";
import { messageLines } from "@/lib/tutor/lines";
import type { TutorOutput } from "@/lib/tutor/schema";
import type { ModelClient } from "@/lib/tutor/turn";

export interface GuardInput { statement: string; hintLevel: HintLevel; submitted: boolean; maxLines: number; output: TutorOutput; toolsCalled: string[] }
export interface GuardResult {
  pass: boolean; reasons: string[]; raw: string; costUsd: number; model: string;
  tokens: { in: number; cached: number; out: number };
}

const verdict = z.object({ pass: z.boolean(), ly_do: z.array(z.string()) }).strict();
const schema = {
  type: "object",
  properties: { pass: { type: "boolean" }, ly_do: { type: "array", items: { type: "string" } } },
  required: ["pass", "ly_do"],
  additionalProperties: false,
};
const none = { in: 0, cached: 0, out: 0 };

export async function runGuard(client: ModelClient, model: string, guardPrompt: string, i: GuardInput): Promise<GuardResult> {
  // Rule 2 (length) is counted by the app itself: no need to pay a model for it.
  const lines = messageLines(i.output.message);
  if (lines > i.maxLines) return { pass: false, reasons: [`2: dài ${lines} dòng > ${i.maxLines}`], raw: "", costUsd: 0, tokens: none, model };
  const user = [
    `Đề bài gốc (đã xác nhận):\n${i.statement}`,
    `Mức gợi ý hiện tại: H${i.hintLevel} | da_nop_loi_giai: ${i.submitted} | max_lines: ${i.maxLines}`,
    `Công cụ đã gọi trong lượt: ${i.toolsCalled.length ? i.toolsCalled.join(", ") : "(không có)"}`,
    `Câu trả lời JSON của gia sư:\n${JSON.stringify(i.output)}`,
  ].join("\n\n");
  try {
    const res = await client.create({
      model, max_tokens: 1500, thinking: { type: "disabled" }, system: guardPrompt,
      messages: [{ role: "user", content: user }],
      output_config: { effort: "low", format: { type: "json_schema", schema } },
    });
    const raw = res.content.filter((p) => p.type === "text").map((p) => p.text ?? "").join("");
    const cached = res.usage.cache_read_input_tokens ?? 0;
    const tokens = { in: res.usage.input_tokens + cached + (res.usage.cache_creation_input_tokens ?? 0), cached, out: res.usage.output_tokens };
    const cost = costUsd(model, res.usage);
    let parsed: z.infer<typeof verdict> | null = null;
    try {
      parsed = verdict.parse(JSON.parse(raw));
    } catch {
      parsed = null;
    }
    if (!parsed) return { pass: false, reasons: ["guard_unreadable"], raw, costUsd: cost, tokens, model };
    return { pass: parsed.pass, reasons: parsed.ly_do, raw, costUsd: cost, tokens, model };
  } catch (e) {
    console.error("guard call failed", e instanceof Error ? e.message : "unknown");
    return { pass: false, reasons: ["guard_unavailable"], raw: "", costUsd: 0, tokens: none, model };
  }
}

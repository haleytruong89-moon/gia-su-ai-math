// lib/tutor/guard.ts — checks every final tutor answer before the child sees it
// (prompts/guard.md = SYSTEM_PROMPT "Prompt bộ kiểm tra"). Fail-closed: when the checker cannot answer,
// the answer counts as not passed, so it is rewritten or replaced by a safe line (DOMAIN §5).
//
// G8-fix2 (D35, 25/11): in real use Haiku wrote "pass: false" and then listed reasons that all said "no
// violation", counted lines wrong and invented rules — 14 of 16 blocks were wrong. So Haiku no longer gives a
// verdict: it answers each rule with a quote and yes/no, and THE SERVER decides. Length is counted by the app;
// "ends with a question" and "valid JSON" are no longer the checker's business (the schema parser covers JSON).
import { z } from "zod";
import { costUsd } from "@/lib/anthropic";
import type { HintLevel } from "@/lib/rules/hints";
import { imageBlocks, type ImageData } from "@/lib/tutor/assemble";
import { messageLines } from "@/lib/tutor/lines";
import type { TutorOutput } from "@/lib/tutor/schema";
import type { ModelClient } from "@/lib/tutor/turn";

export interface GuardInput {
  statement: string; hintLevel: HintLevel; submitted: boolean; maxLines: number; output: TutorOutput; toolsCalled: string[];
  /** The problem photo, while the statement is not confirmed in words yet (G3). */
  images?: ImageData[];
  /** G8-fix2: what the child wrote in this problem, newest last — a number the child gave is not a leak when the tutor repeats it. */
  childText?: string;
  /** G8-fix2: the approved teaching card this answer shows (server-checked code). A card is not a sibling problem. */
  card?: string | null;
}
export interface GuardResult {
  pass: boolean; reasons: string[]; raw: string; costUsd: number; model: string;
  tokens: { in: number; cached: number; out: number };
}

/** The rules Haiku judges, in the order it answers them. `needsQuote`: without a quote the "yes" is ignored. */
export const GUARD_RULES = [
  { key: "lo_dap_so", no: 1, label: "lộ đáp số hoặc lời giải bài gốc", needsQuote: false },
  { key: "trach_moc", no: 4, label: "trách móc, so sánh hoặc nhắc tên/trường", needsQuote: true },
  { key: "khang_dinh_chua_kiem", no: 6, label: "khẳng định đúng/sai khi máy chưa kiểm", needsQuote: true },
  { key: "bai_anh_em_chua_kiem", no: 7, label: "bài anh em chưa qua make_sibling", needsQuote: true },
] as const;
type RuleKey = (typeof GUARD_RULES)[number]["key"];
const item = z.object({ trich: z.string(), vi_pham: z.boolean() }).strict();
const verdict = z.object({ lo_dap_so: item, trach_moc: item, khang_dinh_chua_kiem: item, bai_anh_em_chua_kiem: item }).strict();
export type GuardVerdict = z.infer<typeof verdict>;
// `trich` comes before `vi_pham`: the model writes the evidence first, then the yes/no.
const itemSchema = { type: "object", properties: { trich: { type: "string" }, vi_pham: { type: "boolean" } }, required: ["trich", "vi_pham"], additionalProperties: false };
export const guardJsonSchema = {
  type: "object",
  properties: Object.fromEntries(GUARD_RULES.map((r) => [r.key, itemSchema])) as Record<RuleKey, typeof itemSchema>,
  required: GUARD_RULES.map((r) => r.key),
  additionalProperties: false,
};

/**
 * The server's decision from Haiku's per-rule answers: the reasons to block (empty = pass).
 * A leak (rule 1) counts even without a quote; the other rules need the quoted sentence.
 * An answer that shows an approved card is not a sibling problem (rule 7 does not apply).
 */
export function decideGuard(v: GuardVerdict, o: { card?: string | null } = {}): string[] {
  const out: string[] = [];
  for (const r of GUARD_RULES) {
    const a = v[r.key];
    if (!a.vi_pham) continue;
    const quote = a.trich.trim();
    if (r.needsQuote && !quote) continue;
    if (r.key === "bai_anh_em_chua_kiem" && o.card) continue;
    out.push(`${r.no}: ${r.label}${quote ? ` — "${quote.slice(0, 160)}"` : ""}`);
  }
  return out;
}
const none = { in: 0, cached: 0, out: 0 };

/** A checker reply in the wire format — for the fake client and the tests ({} = nothing found). */
export function guardVerdictJson(violations: Partial<Record<RuleKey, string>> = {}): string {
  return JSON.stringify(Object.fromEntries(GUARD_RULES.map((r) =>
    [r.key, { trich: violations[r.key] ?? "", vi_pham: r.key in violations }])));
}

export async function runGuard(client: ModelClient, model: string, guardPrompt: string, i: GuardInput): Promise<GuardResult> {
  // Rule 2 (length) is counted by the app itself: no need to pay a model for it.
  const lines = messageLines(i.output.message);
  if (lines > i.maxLines) return { pass: false, reasons: [`2: dài ${lines} dòng > ${i.maxLines}`], raw: "", costUsd: 0, tokens: none, model };
  const user = [
    `Đề bài gốc (đã xác nhận):\n${i.statement}`,
    `da_nop_loi_giai: ${i.submitted} | the_giang: ${i.card ?? "không"}`,
    `Em học sinh đã viết trong bài này (mới nhất ở cuối):\n${i.childText?.trim() || "(không có)"}`,
    `Công cụ đã gọi trong lượt: ${i.toolsCalled.length ? i.toolsCalled.join(", ") : "(không có)"}`,
    `Câu trả lời JSON của gia sư:\n${JSON.stringify(i.output)}`,
  ].join("\n\n");
  try {
    const res = await client.create({
      model, max_tokens: 1500, thinking: { type: "disabled" }, system: guardPrompt,
      messages: [{ role: "user", content: i.images?.length ? [...imageBlocks(i.images), { type: "text", text: user }] : user }],
      output_config: { effort: "low", format: { type: "json_schema", schema: guardJsonSchema } },
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
    const reasons = decideGuard(parsed, { card: i.card });
    return { pass: reasons.length === 0, reasons, raw, costUsd: cost, tokens, model };
  } catch (e) {
    console.error("guard call failed", e instanceof Error ? e.message : "unknown");
    return { pass: false, reasons: ["guard_unavailable"], raw: "", costUsd: 0, tokens: none, model };
  }
}

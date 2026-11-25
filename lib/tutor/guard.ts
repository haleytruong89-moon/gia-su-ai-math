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

/** The rules Haiku answers, in the order it answers them. `needsQuote`: without a quote the "yes" is ignored. */
export const GUARD_RULES = [
  { key: "lo_dap_so", no: 1, label: "lộ đáp số hoặc lời giải bài gốc", needsQuote: false },
  { key: "trach_moc", no: 4, label: "trách móc, so sánh hoặc nhắc tên/trường", needsQuote: true },
  { key: "khang_dinh_dung_sai", no: 6, label: "khẳng định đúng/sai khi máy chưa kiểm", needsQuote: true },
  { key: "giai_bai_anh_em", no: 7, label: "bài anh em chưa qua make_sibling", needsQuote: true },
] as const;
type RuleKey = (typeof GUARD_RULES)[number]["key"];
/** What a "right/wrong" sentence of the tutor is about. Only a calculation or an answer needs math_check. */
export const CLAIM_KINDS = ["phep_tinh_hoac_dap_so", "chep_de", "chon_huong_hoac_cach_lam", "hinh_ve_hoac_chung_minh", "khac"] as const;
const item = z.object({ trich: z.string(), vi_pham: z.boolean() }).strict();
const claim = z.object({ trich: z.string(), noi_ve: z.enum(CLAIM_KINDS), vi_pham: z.boolean() }).strict();
const verdict = z.object({ dap_so_bai_goc: z.string(), lo_dap_so: item, trach_moc: item, khang_dinh_dung_sai: claim, giai_bai_anh_em: item }).strict();
export type GuardVerdict = z.infer<typeof verdict>;
// Order matters: the model first works out the answer of the original problem, then for each rule writes the
// quote (and what it is about) BEFORE the yes/no. In real use the old "pass first, reasons after" shape gave
// "pass: false" followed by reasons that all said "no violation".
const str = { type: "string" };
const bool = { type: "boolean" };
const itemSchema = { type: "object", properties: { trich: str, vi_pham: bool }, required: ["trich", "vi_pham"], additionalProperties: false };
export const guardJsonSchema = {
  type: "object",
  properties: {
    dap_so_bai_goc: str,
    lo_dap_so: itemSchema,
    trach_moc: itemSchema,
    khang_dinh_dung_sai: { type: "object", properties: { trich: str, noi_ve: { type: "string", enum: [...CLAIM_KINDS] }, vi_pham: bool },
      required: ["trich", "noi_ve", "vi_pham"], additionalProperties: false },
    giai_bai_anh_em: itemSchema,
  },
  required: ["dap_so_bai_goc", "lo_dap_so", "trach_moc", "khang_dinh_dung_sai", "giai_bai_anh_em"],
  additionalProperties: false,
};

/** Facts the server knows better than Haiku: which tools really ran, and whether a card is shown. */
export interface GuardFacts { card?: string | null; toolsCalled?: readonly string[] }
const mathChecked = (tools: readonly string[]) => tools.some((t) => t.startsWith("math_check(") && !t.includes("→ error"));
const siblingChecked = (tools: readonly string[]) => tools.includes("make_sibling(verified=true, numbers_differ=true)");

/**
 * The server's decision from Haiku's per-rule answers: the reasons to block (empty = pass).
 * - rule 1 (leak) counts even without a quote; the other rules need the quoted sentence;
 * - rule 6: only a claim about a calculation or an answer, and only when no math_check ran successfully this turn;
 * - rule 7: not when make_sibling verified the sibling, and not when the answer shows an approved card.
 */
export function decideGuard(v: GuardVerdict, f: GuardFacts = {}): string[] {
  const tools = f.toolsCalled ?? [];
  const out: string[] = [];
  for (const r of GUARD_RULES) {
    const a = v[r.key];
    if (!a.vi_pham) continue;
    const quote = a.trich.trim();
    if (r.needsQuote && !quote) continue;
    if (r.key === "khang_dinh_dung_sai" && (v.khang_dinh_dung_sai.noi_ve !== "phep_tinh_hoac_dap_so" || mathChecked(tools))) continue;
    if (r.key === "giai_bai_anh_em" && (f.card || siblingChecked(tools))) continue;
    out.push(`${r.no}: ${r.label}${quote ? ` — "${quote.slice(0, 160)}"` : ""}`);
  }
  return out;
}

const none = { in: 0, cached: 0, out: 0 };

/** A checker reply in the wire format — for the fake client and the tests ({} = nothing found). */
export function guardVerdictJson(violations: Partial<Record<RuleKey, string>> = {}, claimAbout: (typeof CLAIM_KINDS)[number] = "phep_tinh_hoac_dap_so"): string {
  const one = (k: RuleKey) => ({ trich: violations[k] ?? "", ...(k === "khang_dinh_dung_sai" ? { noi_ve: k in violations ? claimAbout : "khac" } : {}), vi_pham: k in violations });
  return JSON.stringify({ dap_so_bai_goc: "", ...Object.fromEntries(GUARD_RULES.map((r) => [r.key, one(r.key)])) });
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
    const reasons = decideGuard(parsed, { card: i.card, toolsCalled: i.toolsCalled });
    return { pass: reasons.length === 0, reasons, raw, costUsd: cost, tokens, model };
  } catch (e) {
    console.error("guard call failed", e instanceof Error ? e.message : "unknown");
    return { pass: false, reasons: ["guard_unavailable"], raw: "", costUsd: 0, tokens: none, model };
  }
}

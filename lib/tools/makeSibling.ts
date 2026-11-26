// lib/tools/makeSibling.ts — BÀI ANH EM for H4 (DOMAIN §3.3, §4.12; prompts/sibling.md).
// A sibling is only usable when the machine checked its answer (cas) and its numbers differ from the original.
import { costUsd } from "@/lib/anthropic";
import type { CasClient } from "@/lib/tools/casClient";
import { runMathCheck } from "@/lib/tools/mathCheck";
import type { ModelClient } from "@/lib/tutor/turn";
import { z } from "zod";

export interface SiblingInput { original_statement: string; ku_code: string | null; difficulty: "same" | "easier";
  /** D37: the way the child chose; the worked example follows it step by step. */
  method?: string | null }
export interface SiblingOutput { statement: string; solution_steps: string[]; final_answer: string; verified: boolean; numbers_differ: boolean }
/** One model call made for the sibling (logged as purpose = "sibling"). */
export interface SiblingCall { model: string; raw: string; costUsd: number; tokens: { in: number; cached: number; out: number } }

/** Only modes with a yes/no answer can verify an answer. */
const VERIFY = { check_solution: "satisfies", check_root: "is_root", equivalent: "equivalent" } as const;
const str = { type: "string" };
/** Structured output: every object must close its keys (the API refuses additionalProperties: <schema>, G0 18/11). */
export const siblingJsonSchema = {
  type: "object",
  properties: {
    statement: str,
    solution_steps: { type: "array", items: str },
    final_answer: str,
    check: {
      type: "object",
      properties: {
        mode: { type: "string", enum: Object.keys(VERIFY) },
        equations: { type: "array", items: str },
        // x = 24, y = 48 as pairs: an object with free keys is refused in structured outputs.
        values: { type: "array", items: { type: "object", properties: { name: str, value: str }, required: ["name", "value"], additionalProperties: false } },
        equation: str, value: str, expr_a: str, expr_b: str, variable: str, assumptions: { type: "array", items: str },
      },
      required: ["mode"],
      additionalProperties: false,
    },
  },
  required: ["statement", "solution_steps", "final_answer", "check"],
  additionalProperties: false,
};
const reply = z.object({
  statement: z.string().min(10).max(1500),
  solution_steps: z.array(z.string().min(1)).min(1).max(8),
  final_answer: z.string().min(1).max(400),
  check: z.object({ mode: z.enum(["check_solution", "check_root", "equivalent"]) }).passthrough(),
});

/** The model sends values as [{name, value}] pairs; math_check wants { x: "24", y: "48" }. */
export function checkInput(check: Record<string, unknown>): Record<string, unknown> {
  const v = check.values;
  if (!Array.isArray(v)) return check;
  const values = Object.fromEntries(v.filter((p): p is { name: string; value: string } =>
    !!p && typeof p.name === "string" && typeof p.value === "string").map((p) => [p.name, p.value]));
  return { ...check, values };
}

/** Numbers written in a statement: 16, 1,25 (Vietnamese decimal), 3/4, 25%. */
export function numbersIn(text: string): string[] {
  return [...text.matchAll(/\d+(?:[.,]\d+)?(?:\/\d+)?%?/g)].map((m) => m[0]);
}

/** "Different": at most 1 number shared with the original, and never every number of the original. */
export function numbersDiffer(original: string, sibling: string): boolean {
  const o = new Set(numbersIn(original));
  const s = new Set(numbersIn(sibling));
  const shared = [...o].filter((n) => s.has(n)).length;
  return shared <= 1 && !(o.size > 0 && shared === o.size);
}

export async function makeSibling(
  d: { client: ModelClient; model: string; prompt: string; cas: CasClient | null },
  input: SiblingInput,
): Promise<{ output: SiblingOutput; calls: SiblingCall[] }> {
  const calls: SiblingCall[] = [];
  const failed: SiblingOutput = { statement: "", solution_steps: [], final_answer: "", verified: false, numbers_differ: false };
  let last: SiblingOutput = failed;
  let why = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = [
      `Đề gốc:\n${input.original_statement}`,
      `Mã kiến thức: ${input.ku_code ?? "chưa rõ"} | Độ khó: ${input.difficulty}`,
      ...(input.method ? [`Cách giải phải dùng: ${input.method.slice(0, 120)}`] : []),
      ...(why ? [`Lần trước chưa đúng: ${why}. Soạn lại.`] : []),
    ].join("\n\n");
    let res: Awaited<ReturnType<ModelClient["create"]>>;
    try {
      res = await d.client.create({
      model: d.model, max_tokens: 4000, system: d.prompt, messages: [{ role: "user", content: user }],
      output_config: { effort: "low", format: { type: "json_schema", schema: siblingJsonSchema } },
      });
    } catch (e) {
      // The tutor gets "not verified" and must not use a sibling (rule 11); the turn goes on.
      console.error("make_sibling call failed", e instanceof Error ? e.message : "unknown");
      break;
    }
    const raw = res.content.filter((p) => p.type === "text").map((p) => p.text ?? "").join("");
    const cached = res.usage.cache_read_input_tokens ?? 0;
    calls.push({ model: d.model, raw, costUsd: costUsd(d.model, res.usage),
      tokens: { in: res.usage.input_tokens + cached + (res.usage.cache_creation_input_tokens ?? 0), cached, out: res.usage.output_tokens } });

    let parsed: z.infer<typeof reply> | null = null;
    try {
      const r = reply.safeParse(JSON.parse(raw));
      parsed = r.success ? r.data : null;
    } catch {
      parsed = null;
    }
    if (!parsed) {
      why = "JSON sai khuôn";
      continue;
    }
    const check = await runMathCheck(d.cas, checkInput(parsed.check));
    const key = VERIFY[parsed.check.mode];
    const verified = check.output.ok && check.output.result[key] === true;
    const differ = numbersDiffer(input.original_statement, parsed.statement);
    last = { statement: parsed.statement, solution_steps: parsed.solution_steps, final_answer: parsed.final_answer, verified, numbers_differ: differ };
    if (verified && differ) break;
    why = !check.output.ok ? `máy không kiểm được (${check.output.error})` : !verified ? "đáp số chưa khớp khi máy kiểm" : "dùng lại số của đề gốc";
  }
  return { output: last, calls };
}

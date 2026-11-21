// lib/tutor/reference.ts — LỜI GIẢI THAM KHẢO after self_solved (G4 Q3; G7 P4: child + parents; X5).
// Sonnet writes it; cas checks that its answer is the SAME as the child's machine-checked answer.
// Shown only when the check passes. Never throws.
import { z } from "zod";
import { costUsd } from "@/lib/anthropic";
import type { CasClient } from "@/lib/tools/casClient";
import { runMathCheck } from "@/lib/tools/mathCheck";
import type { ModelClient } from "@/lib/tutor/turn";

const str = { type: "string" };
export const referenceJsonSchema = {
  type: "object",
  properties: {
    steps: { type: "array", items: str },
    final_answer: str,
    final_expr: { type: ["string", "null"] },
    final_values: {
      type: "array",
      items: { type: "object", properties: { name: str, value: str }, required: ["name", "value"], additionalProperties: false },
    },
  },
  required: ["steps", "final_answer", "final_expr", "final_values"],
  additionalProperties: false,
};
const reply = z.object({
  steps: z.array(z.string().min(1)).min(1),
  final_answer: z.string().min(1),
  final_expr: z.string().nullable(),
  final_values: z.array(z.object({ name: z.string(), value: z.string() })),
});

export const MAX_STEPS = 10;
/** The math_check that confirmed the child's final answer in the self_solved turn. */
export interface ChildCheck { mode: string; input: Record<string, unknown> }
export interface ReferenceCall { model: string; raw: string; costUsd: number; tokens: { in: number; cached: number; out: number } }
export interface Reference { steps: string[]; finalAnswer: string; verified: boolean }

/** The cas checks that prove the reference answer equals the child's checked answer; null = cannot compare. */
export function sameAnswerChecks(child: ChildCheck, ref: { final_expr: string | null; final_values: { name: string; value: string }[] }): Record<string, unknown>[] | null {
  const i = child.input;
  const variable = typeof i.variable === "string" ? i.variable : "x";
  const assumptions = Array.isArray(i.assumptions) ? i.assumptions : [];
  if (child.mode === "simplify_check" || child.mode === "equivalent") {
    if (!ref.final_expr || typeof i.expr_a !== "string") return null;
    return [{ mode: "equivalent", expr_a: ref.final_expr, expr_b: i.expr_a, variable, assumptions }];
  }
  if (child.mode === "check_root") {
    if (typeof i.equation !== "string" || !ref.final_values.length) return null;
    return ref.final_values.map((v) => ({ mode: "check_root", equation: i.equation, value: v.value, variable }));
  }
  if (child.mode === "check_solution") {
    if (!Array.isArray(i.equations) || !ref.final_values.length) return null;
    return [{ mode: "check_solution", equations: i.equations, values: Object.fromEntries(ref.final_values.map((v) => [v.name, v.value])) }];
  }
  return null;
}

const KEY: Record<string, string> = { equivalent: "equivalent", check_root: "is_root", check_solution: "satisfies" };

export async function writeReference(
  d: { client: ModelClient; model: string; prompt: string; cas: CasClient | null },
  input: { statement: string; grade: 6 | 9; childCheck: ChildCheck },
): Promise<{ reference: Reference | null; call: ReferenceCall | null }> {
  try {
    const res = await d.client.create({
      model: d.model, max_tokens: 4000,
      system: [{ type: "text", text: d.prompt }],
      messages: [{ role: "user", content: `Lớp: ${input.grade}\nĐề bài:\n${input.statement}` }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: referenceJsonSchema } },
    });
    const raw = res.content.filter((p) => p.type === "text").map((p) => p.text ?? "").join("");
    const cached = res.usage.cache_read_input_tokens ?? 0;
    const call: ReferenceCall = { model: d.model, raw, costUsd: costUsd(d.model, res.usage),
      tokens: { in: res.usage.input_tokens + cached + (res.usage.cache_creation_input_tokens ?? 0), cached, out: res.usage.output_tokens } };
    let a: z.infer<typeof reply>;
    try {
      a = reply.parse(JSON.parse(raw));
    } catch {
      return { reference: null, call };
    }
    const checks = sameAnswerChecks(input.childCheck, a);
    let verified = false;
    if (checks) {
      const results = await Promise.all(checks.map((c) => runMathCheck(d.cas, c)));
      verified = results.every((r, k) => r.output.ok && r.output.result[KEY[String(checks[k]!.mode)]!] === true);
    }
    return { reference: { steps: a.steps.slice(0, MAX_STEPS), finalAnswer: a.final_answer, verified }, call };
  } catch (e) {
    console.error("reference call failed", e instanceof Error ? e.message : "unknown");
    return { reference: null, call: null };
  }
}

import { describe, expect, it } from "vitest";
import { referenceJsonSchema, sameAnswerChecks, writeReference } from "@/lib/tutor/reference";
import type { CasClient } from "@/lib/tools/casClient";

const usage = { input_tokens: 500, output_tokens: 200 };
const model = (o: unknown) => ({ async create() { return { content: [{ type: "text", text: JSON.stringify(o) }], usage }; } });
const cas = (verdicts: Record<string, Record<string, unknown>>): CasClient & { calls: { mode: string; args: Record<string, unknown> }[] } => {
  const calls: { mode: string; args: Record<string, unknown> }[] = [];
  return { calls, async check(mode, args) { calls.push({ mode, args }); return verdicts[mode] ? { ok: true, result: verdicts[mode]! } : { ok: false, error: "timeout" }; }, async health() { return true; } };
};
const D = { model: "claude-sonnet-5-5", prompt: "LỜI GIẢI THAM KHẢO" };
const simplifyChild = { mode: "simplify_check", input: { mode: "simplify_check", expr_a: "3/(3-sqrt(x))", expr_b: "…", variable: "x", assumptions: ["x>=0"] } };
const good = { steps: ["ĐKXĐ: x ≥ 0, x ≠ 9", "…", "Vậy P = 3/(3 − √x)"], final_answer: "P = 3/(3 − √x)", final_expr: "3/(3 - sqrt(x))", final_values: [] };

describe("sameAnswerChecks (X5: the reference must equal the child's checked answer)", () => {
  it("simplify / equivalent → equivalent(reference, child)", () =>
    expect(sameAnswerChecks(simplifyChild, good)).toEqual([{ mode: "equivalent", expr_a: "3/(3 - sqrt(x))", expr_b: "3/(3-sqrt(x))", variable: "x", assumptions: ["x>=0"] }]));
  it("check_root → every reference value is a root of the child's equation", () =>
    expect(sameAnswerChecks({ mode: "check_root", input: { equation: "x - 4 = 0", value: "4" } }, { final_expr: null, final_values: [{ name: "x", value: "4" }] }))
      .toEqual([{ mode: "check_root", equation: "x - 4 = 0", value: "4", variable: "x" }]));
  it("check_solution → the reference values satisfy the child's system", () =>
    expect(sameAnswerChecks({ mode: "check_solution", input: { equations: ["x + y = 50", "x - y = 10"] } }, { final_expr: null, final_values: [{ name: "x", value: "30" }, { name: "y", value: "20" }] }))
      .toEqual([{ mode: "check_solution", equations: ["x + y = 50", "x - y = 10"], values: { x: "30", y: "20" } }]));
  it("missing pieces → cannot compare", () => {
    expect(sameAnswerChecks(simplifyChild, { final_expr: null, final_values: [] })).toBeNull();
    expect(sameAnswerChecks({ mode: "solve", input: {} }, good)).toBeNull();
  });
});

describe("writeReference", () => {
  it("cas says the same answer → verified, steps kept", async () => {
    const c = cas({ equivalent: { equivalent: true } });
    const r = await writeReference({ ...D, client: model(good), cas: c }, { statement: "Rút gọn P", grade: 9, childCheck: simplifyChild });
    expect(r.reference).toEqual({ steps: good.steps, finalAnswer: "P = 3/(3 − √x)", verified: true });
    expect(r.call).toMatchObject({ model: "claude-sonnet-5-5", tokens: { in: 500, out: 200 } });
  });
  it("a different answer, a cas error or no comparison → not verified", async () => {
    expect((await writeReference({ ...D, client: model(good), cas: cas({ equivalent: { equivalent: false } }) }, { statement: "x", grade: 9, childCheck: simplifyChild })).reference?.verified).toBe(false);
    expect((await writeReference({ ...D, client: model(good), cas: cas({}) }, { statement: "x", grade: 9, childCheck: simplifyChild })).reference?.verified).toBe(false);
    expect((await writeReference({ ...D, client: model({ ...good, final_expr: null }), cas: cas({ equivalent: { equivalent: true } }) }, { statement: "x", grade: 9, childCheck: simplifyChild })).reference?.verified).toBe(false);
  });
  it("more than 10 steps are cut", async () => {
    const r = await writeReference({ ...D, client: model({ ...good, steps: Array.from({ length: 14 }, (_, i) => `b${i}`) }), cas: cas({ equivalent: { equivalent: true } }) },
      { statement: "x", grade: 9, childCheck: simplifyChild });
    expect(r.reference?.steps).toHaveLength(10);
  });
  it("unreadable output → no reference; API error → nothing, never throws", async () => {
    expect((await writeReference({ ...D, client: { async create() { return { content: [{ type: "text", text: "?" }], usage }; } }, cas: null }, { statement: "x", grade: 6, childCheck: simplifyChild })).reference).toBeNull();
    expect(await writeReference({ ...D, client: { async create() { throw new Error("529"); } }, cas: null }, { statement: "x", grade: 6, childCheck: simplifyChild })).toEqual({ reference: null, call: null });
  });
  it("schema is API-safe", () => {
    const walk = (o: Record<string, unknown>): void => {
      if (o.type === "object") expect(o.additionalProperties).toBe(false);
      for (const v of Object.values(o)) if (v && typeof v === "object") walk(v as Record<string, unknown>);
    };
    walk(referenceJsonSchema);
    expect(JSON.stringify(referenceJsonSchema)).not.toMatch(/maxLength|minLength|maxItems|minItems|minimum|maximum/);
  });
});

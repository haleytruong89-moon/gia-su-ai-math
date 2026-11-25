// D36: the exact number checker used when the algebra service (cas) is missing or does not answer.
import { describe, expect, it } from "vitest";
import { evalExact, fracText, localCas } from "@/lib/tools/localCas";
import type { CasClient } from "@/lib/tools/casClient";

const v = (expr: string, vars?: Record<string, string>) => {
  const r = evalExact(expr, vars);
  return r ? fracText(r) : null;
};

describe("evalExact — exact fractions, no rounding", () => {
  it("grade 6 number work: ƯCLN, BCNN, fractions, powers", () => {
    expect(v("gcd(84, 252)")).toBe("84");
    expect(v("lcm(10, 12, 15)")).toBe("60");
    expect(v("ƯCLN(84; 252)")).toBe("84");
    expect(v("BCNN(3, 5, 7)")).toBe("105");
    expect(v("3/4 + 1/6")).toBe("11/12");
    expect(v("2^3 × 5")).toBe("40");
    expect(v("2**3 * 5")).toBe("40");
    expect(v("252 : 84")).toBe("3");
    expect(v("12 ÷ 8")).toBe("3/2");
    expect(v("1,25 * 4")).toBe("5");
    expect(v("-(3 - 7) · 2")).toBe("8");
    expect(v("2^-2")).toBe("1/4");
  });
  it("letters are replaced by the given numbers", () => {
    expect(v("(x + 1)/3", { x: "5" })).toBe("2");
    expect(v("1/x + 1/y", { x: "24", y: "48" })).toBe("1/16");
    expect(v("2x + 3y", { x: "1", y: "2" })).toBe("8"); // implicit multiplication
  });
  it("anything it cannot do exactly → null (the caller reports an error, never a guess)", () => {
    for (const e of ["sqrt(4)", "√9", "1/0", "y + 1", "2^(1/2)", "gcd(2.5, 5)", "", "3 +", "sin(30)", "x = 2"]) expect(v(e), e).toBeNull();
  });
});

describe("localCas", () => {
  const cas = localCas(null);
  it("is marked limited when there is no algebra service", () => {
    expect(cas.limited).toBe(true);
    expect(localCas({ check: async () => ({ ok: true, result: {} }), health: async () => true }).limited).toBe(false);
  });
  it("evaluate → { exact }", async () => {
    expect(await cas.check("evaluate", { expr: "gcd(84, 252)", variable: "x" })).toEqual({ ok: true, result: { exact: "84" } });
    expect(await cas.check("evaluate", { expr: "x^2 - 1", variable: "x", value: "3" })).toEqual({ ok: true, result: { exact: "8" } });
  });
  it("equivalent with numbers only", async () => {
    expect(await cas.check("equivalent", { expr_a: "84", expr_b: "gcd(84, 252)", variable: "x", assumptions: [] }))
      .toEqual({ ok: true, result: { equivalent: true, method: "exact_numbers" } });
    expect(await cas.check("equivalent", { expr_a: "42", expr_b: "gcd(84, 252)", variable: "x", assumptions: [] }))
      .toEqual({ ok: true, result: { equivalent: false, method: "exact_numbers" } });
  });
  it("check_root and check_solution substitute the numbers (the sibling check of a word problem)", async () => {
    expect(await cas.check("check_root", { equation: "3x - 12 = 0", value: "4", variable: "x" })).toEqual({ ok: true, result: { is_root: true, undefined: false } });
    expect(await cas.check("check_root", { equation: "3x - 12 = 0", value: "5", variable: "x" })).toEqual({ ok: true, result: { is_root: false, undefined: false } });
    const eqs = ["1/x + 1/y = 1/16", "3/x + 6/y = 1/4"];
    expect(await cas.check("check_solution", { equations: eqs, values: { x: "24", y: "48" } })).toEqual({ ok: true, result: { satisfies: true, failed: [] } });
    expect(await cas.check("check_solution", { equations: eqs, values: { x: "20", y: "48" } }))
      .toEqual({ ok: true, result: { satisfies: false, failed: eqs } });
  });
  it("algebra it cannot do (letters left, roots, other modes) → cas_not_configured", async () => {
    expect(await cas.check("equivalent", { expr_a: "x + 1", expr_b: "1 + x", variable: "x", assumptions: [] })).toEqual({ ok: false, error: "cas_not_configured" });
    expect(await cas.check("evaluate", { expr: "sqrt(2)", variable: "x" })).toEqual({ ok: false, error: "cas_not_configured" });
    expect(await cas.check("simplify_check", { expr_child: "1", expr_original: "1", variable: "x", assumptions: [] })).toEqual({ ok: false, error: "cas_not_configured" });
    expect(await cas.check("check_root", { equation: "x^2 = 2", value: "sqrt(2)", variable: "x" })).toEqual({ ok: false, error: "cas_not_configured" });
  });
  it("with an algebra service: its answer wins; numbers only when it is down", async () => {
    const calls: string[] = [];
    const remote = (r: Awaited<ReturnType<CasClient["check"]>>): CasClient => ({ check: async (m) => { calls.push(m); return r; }, health: async () => true });
    expect(await localCas(remote({ ok: true, result: { exact: "99" } })).check("evaluate", { expr: "1+1", variable: "x" })).toEqual({ ok: true, result: { exact: "99" } });
    for (const err of ["timeout", "cas_unreachable", "cas_http_502"])
      expect(await localCas(remote({ ok: false, error: err })).check("evaluate", { expr: "1+1", variable: "x" }), err).toEqual({ ok: true, result: { exact: "2" } });
    // a real answer from SymPy ("cannot parse") is kept, not second-guessed
    expect(await localCas(remote({ ok: false, error: "parse_error" })).check("evaluate", { expr: "1+1", variable: "x" })).toEqual({ ok: false, error: "parse_error" });
    // down and not a number job → the service's own error
    expect(await localCas(remote({ ok: false, error: "timeout" })).check("solve", { equation: "x = 1", variable: "x" })).toEqual({ ok: false, error: "timeout" });
  });
});

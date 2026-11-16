import { describe, expect, it } from "vitest";
import { runMathCheck, toCasArgs } from "@/lib/tools/mathCheck";
import type { CasClient } from "@/lib/tools/casClient";

const P = "sqrt(x)/(sqrt(x)-3) + 2*sqrt(x)/(sqrt(x)+3) - (3*x+9)/(x-9)";

describe("math_check tool → cas arguments", () => {
  it("simplify_check (BO_TEST 9.16): the child's result is expr_a, the original is expr_b", () => {
    expect(toCasArgs({ mode: "simplify_check", expr_a: "(-3*sqrt(x)-9)/(x-9)", expr_b: P, assumptions: ["x >= 0", "x != 9"] }))
      .toEqual({ expr_child: "(-3*sqrt(x)-9)/(x-9)", expr_original: P, variable: "x", assumptions: ["x >= 0", "x != 9"] });
  });
  it("systems (9.1, 9.23) and grade 6 lcm (6.9)", () => {
    expect(toCasArgs({ mode: "check_solution", equations: ["1/x+1/y=1/16"], values: { x: "24", y: "48" } }))
      .toEqual({ equations: ["1/x+1/y=1/16"], values: { x: "24", y: "48" } });
    expect(toCasArgs({ mode: "solve_system", equations: ["x+y=5", "x-y=1"], variables: ["x", "y"] }))
      .toEqual({ equations: ["x+y=5", "x-y=1"], variables: ["x", "y"] });
    expect(toCasArgs({ mode: "evaluate", expr_a: "lcm(10, 12, 15)" })).toEqual({ expr: "lcm(10, 12, 15)", variable: "x" });
  });
  it("other modes", () => {
    expect(toCasArgs({ mode: "check_root", equation: "x - 2 = 0", value: "2" })).toEqual({ equation: "x - 2 = 0", value: "2", variable: "x" });
    expect(toCasArgs({ mode: "inequality", inequality: "2*x - 4 > 0" })).toEqual({ inequality_text: "2*x - 4 > 0", variable: "x" });
    expect(toCasArgs({ mode: "domain", expr_a: "1/(x-9)", variable: "x" })).toEqual({ expr: "1/(x-9)", variable: "x" });
    expect(toCasArgs({ mode: "equivalent", expr_a: "a", expr_b: "b", variable: "t" })).toEqual({ expr_a: "a", expr_b: "b", variable: "t", assumptions: [] });
  });
  it("a missing field, an unknown mode or a non-object → null", () => {
    expect(toCasArgs({ mode: "check_root", equation: "x = 2" })).toBeNull();
    expect(toCasArgs({ mode: "simplify_check", expr_a: "x" })).toBeNull();
    expect(toCasArgs({ mode: "magic" })).toBeNull();
    expect(toCasArgs("hello")).toBeNull();
  });
});

describe("runMathCheck", () => {
  const casOk = (): CasClient & { calls: number } => {
    const c = { calls: 0, check: async () => { c.calls++; return { ok: true as const, result: { is_root: true } }; }, health: async () => true };
    return c;
  };
  it("calls cas and passes its answer through", async () => {
    const cas = casOk();
    expect(await runMathCheck(cas, { mode: "check_root", equation: "x - 2 = 0", value: "2" }))
      .toEqual({ ok: true, output: { ok: true, result: { is_root: true } } });
    expect(cas.calls).toBe(1);
  });
  it("a missing field is an error result; cas is not called", async () => {
    const cas = casOk();
    expect(await runMathCheck(cas, { mode: "check_root", equation: "x = 2" })).toEqual({ ok: false, output: { ok: false, error: "missing_field" } });
    expect(cas.calls).toBe(0);
  });
  it("no cas configured → an error result (the tutor must not claim right or wrong)", async () => {
    expect(await runMathCheck(null, { mode: "evaluate", expr_a: "1+1" })).toEqual({ ok: false, output: { ok: false, error: "cas_not_configured" } });
  });
  it("a cas error stays an error", async () => {
    const cas: CasClient = { check: async () => ({ ok: false, error: "timeout" }), health: async () => true };
    expect(await runMathCheck(cas, { mode: "evaluate", expr_a: "1+1" })).toEqual({ ok: false, output: { ok: false, error: "timeout" } });
  });
});

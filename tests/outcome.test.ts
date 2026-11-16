import { describe, expect, it } from "vitest";
import { decideOutcome } from "@/lib/rules/outcome";
import fewshot from "./fixtures/fewshot.json";
import type { TutorOutput } from "@/lib/tutor/schema";

const out = (o: Partial<TutorOutput>): TutorOutput => ({ ...(fewshot as unknown as TutorOutput[])[1]!, flags: [], ket_qua_bai: "in_progress", ...o });

describe("decideOutcome (DOMAIN §4.4, §4.12, §5)", () => {
  it("4.12 b: model says self_solved but no math_check → stays in_progress", () =>
    expect(decideOutcome({ turn: 6, output: out({ ket_qua_bai: "self_solved" }), submitted: true, offtopicCount: 0 }))
      .toEqual({ status: "in_progress", offtopicCount: 0, solveBlocked: "no_passing_math_check" }));
  it("4.4 e: a submitted geometry proof → pending_review (D18)", () =>
    expect(decideOutcome({ turn: 3, output: out({ ket_qua_bai: "pending_review", flags: ["geometry_proof"] }), submitted: true, offtopicCount: 0 }).status)
      .toBe("pending_review"));
  it("geometry flag but the child did not submit → in_progress", () =>
    expect(decideOutcome({ turn: 3, output: out({ ket_qua_bai: "pending_review", flags: ["geometry_proof"] }), submitted: false, offtopicCount: 0 }).status)
      .toBe("in_progress"));
  it("the model cannot close as saved_for_later (only the child's button can)", () =>
    expect(decideOutcome({ turn: 5, output: out({ ket_qua_bai: "saved_for_later" }), submitted: false, offtopicCount: 0 }).status).toBe("in_progress"));
  it("4.4 h: turn 20 → timed_out", () => expect(decideOutcome({ turn: 20, output: out({}), submitted: false, offtopicCount: 0 }).status).toBe("timed_out"));
  it("§5: third off-topic turn → closed_offtopic", () => {
    expect(decideOutcome({ turn: 4, output: out({ flags: ["off_topic"] }), submitted: false, offtopicCount: 1 })).toEqual({ status: "in_progress", offtopicCount: 2, solveBlocked: null });
    expect(decideOutcome({ turn: 5, output: out({ flags: ["off_topic"] }), submitted: false, offtopicCount: 2 })).toEqual({ status: "closed_offtopic", offtopicCount: 3, solveBlocked: null });
  });
  it("no readable output (safe line) → in_progress, counters unchanged", () =>
    expect(decideOutcome({ turn: 4, output: null, submitted: false, offtopicCount: 1 })).toEqual({ status: "in_progress", offtopicCount: 1, solveBlocked: null }));

  // G4 — DOMAIN §4.12 a–c (phụ huynh chốt 15/11/2026) with the real math_check log
  const ok = (mode: string, result: Record<string, unknown>) => ({ ok: true, mode, result });
  const solved = out({ ket_qua_bai: "self_solved" });
  const base = { turn: 6, output: solved, submitted: true, offtopicCount: 0 };
  it("4.12 a: submitted, cas confirms and the expression is fully simplified, checklist asked → self_solved", () =>
    expect(decideOutcome({ ...base, checks: [ok("simplify_check", { equivalent: true, fully_simplified: true })],
      checklistRequired: true, checklistAsked: [7] }).status).toBe("self_solved"));
  it("4.12 c: equivalent but a common factor is left → not_fully_simplified", () =>
    expect(decideOutcome({ ...base, checks: [ok("simplify_check", { equivalent: true, fully_simplified: false, common_factor: "sqrt(x) + 3" })],
      checklistRequired: true, checklistAsked: [7] })).toMatchObject({ status: "in_progress", solveBlocked: "not_fully_simplified" }));
  it("a failed math_check (cas error) does not count", () =>
    expect(decideOutcome({ ...base, checks: [{ ok: false, mode: "check_root", result: null }], checklistRequired: false }).solveBlocked)
      .toBe("no_passing_math_check"));
  it("Q2: grade 9 with no checklist item asked → checklist_open; grade 6 (not required) → self_solved", () => {
    const i = { ...base, checks: [ok("check_solution", { satisfies: true, failed: [] })], checklistAsked: [] };
    expect(decideOutcome({ ...i, checklistRequired: true }).solveBlocked).toBe("checklist_open");
    expect(decideOutcome({ ...i, checks: [ok("check_root", { is_root: true })], checklistRequired: false }).status).toBe("self_solved");
  });
  it("not submitted → never self_solved, even with a passing check", () =>
    expect(decideOutcome({ ...base, submitted: false, checks: [ok("check_root", { is_root: true })] }).status).toBe("in_progress"));
});

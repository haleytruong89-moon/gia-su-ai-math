import { describe, expect, it } from "vitest";
import { decideOutcome } from "@/lib/rules/outcome";
import fewshot from "./fixtures/fewshot.json";
import type { TutorOutput } from "@/lib/tutor/schema";

const out = (o: Partial<TutorOutput>): TutorOutput => ({ ...(fewshot as unknown as TutorOutput[])[1]!, flags: [], ket_qua_bai: "in_progress", ...o });

describe("decideOutcome (DOMAIN §4.4, §4.12, §5)", () => {
  it("4.12 b: model says self_solved but no math_check yet (G2) → stays in_progress", () =>
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
});

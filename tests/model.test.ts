import { describe, expect, it } from "vitest";
import { pickModel, rewriteRoute, strongPaused, type RouteInput } from "@/lib/rules/model";

const base: RouteInput = { grade: 9, hintLevel: 0, nan: false, prevTutorUnsure: false, problemUsedStrong: false, strongPaused: false };

describe("pickModel (DOMAIN §4.14)", () => {
  it("a: grade 9, turn 1, H0 → Sonnet", () => expect(pickModel(base)).toEqual({ tier: "main", reason: null }));
  it("b: H2, one mistake → Sonnet", () => expect(pickModel({ ...base, hintLevel: 2 })).toEqual({ tier: "main", reason: null }));
  it("c: the server just raised to H3 → Opus (hint_h3)", () => expect(pickModel({ ...base, hintLevel: 3 })).toEqual({ tier: "strong", reason: "hint_h3" }));
  it("e: grade 6, nản → Opus (nan)", () => expect(pickModel({ ...base, grade: 6, nan: true, hintLevel: 4 })).toEqual({ tier: "strong", reason: "nan" }));
  it("f: problem already used Opus, now H1 → still Opus (sticky)", () =>
    expect(pickModel({ ...base, hintLevel: 1, problemUsedStrong: true })).toEqual({ tier: "strong", reason: "sticky" }));
  it("g: a new problem starts on Sonnet", () => expect(pickModel(base).tier).toBe("main"));
  it("tutor said it was unsure last turn → Opus", () => expect(pickModel({ ...base, prevTutorUnsure: true })).toEqual({ tier: "strong", reason: "tutor_unsure" }));
  it("h: grade 9 geometry proof → Opus; i: grade 6 geometry → Sonnet", () => {
    expect(pickModel({ ...base, geometryProof: true })).toEqual({ tier: "strong", reason: "geometry_proof" });
    expect(pickModel({ ...base, grade: 6, geometryProof: true })).toEqual({ tier: "main", reason: null });
  });
  it("hard exam slots (grade 9 only)", () => {
    expect(pickModel({ ...base, examSlot: "HN10-2c" })).toEqual({ tier: "strong", reason: "exam_slot_hard" });
    expect(pickModel({ ...base, examSlot: "HN10-1a" })).toEqual({ tier: "main", reason: null });
  });
  it("j: Opus paused (45 USD), grade 9 nản → Sonnet, reason opus_paused (report: 'should have escalated')", () =>
    expect(pickModel({ ...base, nan: true, hintLevel: 4, strongPaused: true })).toEqual({ tier: "main", reason: "opus_paused" }));
  it("paused and nothing to escalate → plain Sonnet", () => expect(pickModel({ ...base, strongPaused: true })).toEqual({ tier: "main", reason: null }));
});

describe("rewriteRoute (§4.14 d, §5)", () => {
  // D36 (25/11): a rewrite keeps the model of the turn. In real use every block moved the whole problem to Opus.
  it("d: a Sonnet answer is rewritten on Sonnet", () => expect(rewriteRoute(false, "main")).toEqual({ tier: "main", reason: "guard_blocked" }));
  it("d: an Opus answer is rewritten on Opus", () => expect(rewriteRoute(false, "strong")).toEqual({ tier: "strong", reason: "guard_blocked" }));
  it("paused: always rewritten on Sonnet", () => expect(rewriteRoute(true, "strong")).toEqual({ tier: "main", reason: "opus_paused" }));
});

describe("strongPaused (D29)", () => {
  it("pauses at 45 USD or when the month is marked economy", () => {
    expect(strongPaused({ costUsd: 44.99, mode: "normal" })).toBe(false);
    expect(strongPaused({ costUsd: 45, mode: "normal" })).toBe(true);
    expect(strongPaused({ costUsd: 3, mode: "economy" })).toBe(true);
  });
});

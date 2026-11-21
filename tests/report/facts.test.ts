import { describe, expect, it } from "vitest";
import { factsFromRows, isCasFailure, type ProblemRowLite } from "@/lib/report/facts";

const prob = (o: Partial<ProblemRowLite> = {}): ProblemRowLite => ({
  id: "a", session_id: "s", status: "pending_review", hint_level_max: 2, nan_jumps: 0, u_level: 2,
  ku_code: "T9.9", exam_slot: null, prereq_gaps: null, confirmed_statement: "đề", created_at: "2026-11-18T10:00:00Z", ...o,
});

describe("isCasFailure (§4.7 C1 lỗi: the service failed, not the model's input)", () => {
  it.each([
    [{ ok: false, error: "timeout" }, true], [{ ok: false, error: "cas_unreachable" }, true], [{ ok: false, error: "cas_http_500" }, true],
    [{ ok: false, error: "cas_bad_reply" }, true], [{ ok: false, error: "cas_not_configured" }, true], [{ ok: false, error: "internal:ZeroDivisionError" }, true],
    [{ ok: false, error: "missing_field" }, false], [{ ok: false, error: "cannot parse 'x+'" }, false], [{ ok: true, result: {} }, false], [null, false],
  ])("%j → %s", (o, v) => expect(isCasFailure(o)).toBe(v));
});

describe("factsFromRows", () => {
  it("geometry proof from the classify call; rewritten = tutor calls shown after a rewrite; cas errors = failed math_check", () => {
    const d = factsFromRows({
      problems: [prob()],
      calls: [
        { problem_id: "a", purpose: "classify", guard_result: null, raw_output: JSON.stringify({ ku_code: null, exam_slot: null, geometry_proof: true }) },
        { problem_id: "a", purpose: "tutor", guard_result: "rewritten", raw_output: "{}" },
        { problem_id: "a", purpose: "tutor", guard_result: "rewritten", raw_output: "{}" },
        { problem_id: "a", purpose: "guard", guard_result: null, raw_output: "{}" },
      ],
      tools: [
        { problem_id: "a", tool: "math_check", output: { ok: false, error: "timeout" } },
        { problem_id: "a", tool: "math_check", output: { ok: false, error: "cas_http_500" } },
        { problem_id: "a", tool: "math_check", output: { ok: false, error: "missing_field" } },
        { problem_id: "a", tool: "lookup", output: { ok: false, error: "timeout" } },
      ],
      sessionsAbandoned: 0,
      ratings: [{ face: "hard" }, { face: "ok" }],
    });
    expect(d.problems[0]).toEqual({
      id: "a", status: "pending_review", hintLevelMax: 2, nanJumps: 0, uLevel: 2, kuCode: "T9.9", examSlot: null,
      prereqGaps: [], geometryProof: true, rewrittenCount: 2, referenceMismatch: false,
    });
    expect(d.casErrors).toBe(2);
    expect(d.ratingsHard).toBe(1);
  });
  it("a tutor flag geometry_proof also counts; unreadable raw output is ignored", () => {
    const d = factsFromRows({
      problems: [prob({ id: "b", prereq_gaps: ["N8.10"] })],
      calls: [{ problem_id: "b", purpose: "tutor", guard_result: "pass", raw_output: JSON.stringify({ flags: ["geometry_proof"] }) },
        { problem_id: "b", purpose: "classify", guard_result: null, raw_output: "not json" }],
      tools: [], sessionsAbandoned: 1, ratings: [],
    });
    expect(d.problems[0]).toMatchObject({ geometryProof: true, prereqGaps: ["N8.10"] });
    expect(d.sessionsAbandoned).toBe(1);
  });
});

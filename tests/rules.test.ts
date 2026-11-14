// Expected values are the parent-confirmed examples in docs/DOMAIN.md (§4.1, §4.2, §4.6, §4.11, §4.12),
// not numbers copied from running the code.
import { describe, expect, it } from "vitest";
import { addDays, dateVn } from "@/lib/time";
import { isNanSignal, isTerse, NOT_UNDERSTOOD, type ChildEvent } from "@/lib/rules/nan";
import { applyPreTurn, nextHintLevel, type HintState } from "@/lib/rules/hints";
import { applyReviewResult, pickDue, reopenAfterMistake, type ReviewItem } from "@/lib/rules/review";
import { decideSolve } from "@/lib/rules/solveGate";

const at = (level: HintState["hintLevel"], afterSibling = false): HintState => ({
  hintLevel: level, hintLevelMax: level, nanJumps: 0, afterSibling,
});
const text = (t: string): ChildEvent => ({ kind: "text", text: t });

describe("§4.6 ngày theo giờ Việt Nam", () => {
  it("16:59 UTC 14/11 is still 14/11 in Vietnam", () => {
    expect(dateVn(new Date("2026-11-14T16:59:00Z"))).toBe("2026-11-14");
  });
  it("17:00 UTC 14/11 is 15/11 in Vietnam", () => {
    expect(dateVn(new Date("2026-11-14T17:00:00Z"))).toBe("2026-11-15");
  });
  it("addDays crosses month ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });
});

describe("§4.1 leo thang gợi ý", () => {
  it("a: H0, wrong answer → H1", () => {
    expect(nextHintLevel(at(0), "sai").hintLevel).toBe(1);
  });
  it("b: H2, asks for the answer → H3 (never straight to H5)", () => {
    expect(nextHintLevel(at(2), "xin_dap_an").hintLevel).toBe(3);
  });
  it("c: H1, 'k' then 'ko biết' → nản → H4", () => {
    const nan = isNanSignal([text("k"), text("ko biết")]);
    expect(nan).toBe(true);
    const { state, jumped } = applyPreTurn(at(1), { nan });
    expect([state.hintLevel, state.nanJumps, jumped]).toEqual([4, 1, true]);
  });
  it("d: H4 after the sibling, still wrong → H5", () => {
    expect(nextHintLevel(at(4, true), "sai").hintLevel).toBe(5);
  });
  it("e: H2, correct next step → stays H2", () => {
    expect(nextHintLevel(at(2), "dung").hintLevel).toBe(2);
  });
  it("H4 before the sibling is done does not jump to H5", () => {
    expect(nextHintLevel(at(4, false), "sai").hintLevel).toBe(4);
  });
  it("nản at H4 does not jump again or count", () => {
    expect(applyPreTurn(at(4), { nan: true }).jumped).toBe(false);
  });
});

describe("§4.2 nhận diện nản", () => {
  it("a: 'ok' then 'x=6' is not nản", () => {
    expect(isNanSignal([text("ok"), text("x=6")])).toBe(false);
  });
  it("c: 'Chưa hiểu' twice at two different places is not nản", () => {
    expect(isNanSignal([
      { kind: "button", label: NOT_UNDERSTOOD, replyTo: "m1" },
      { kind: "button", label: NOT_UNDERSTOOD, replyTo: "m2" },
    ])).toBe(false);
  });
  it("'Chưa hiểu' 3 times for the same explanation is nản", () => {
    const b = { kind: "button", label: NOT_UNDERSTOOD, replyTo: "m1" } as const;
    expect(isNanSignal([b, b, b])).toBe(true);
  });
  it("d: 'ok', 'ok' is nản", () => {
    expect(isNanSignal([text("ok"), text("ok")])).toBe(true);
  });
  it("e: 'k', button, 'k' is not nản (the button breaks the run)", () => {
    expect(isNanSignal([text("k"), { kind: "button", label: "Hiểu rồi" }, text("k")])).toBe(false);
  });
  it("9.12: a short math answer 'x=24' is content, not terse", () => {
    expect(isTerse("x=24")).toBe(false);
  });
});

describe("§4.11 ôn cách quãng", () => {
  const item = (over: Partial<ReviewItem> = {}): ReviewItem => ({
    id: "r1", box: 1, dueDateVn: "2026-11-15", correctStreak: 0, status: "active", ...over,
  });
  it("a: box 1, correct → box 2, due in 3 days, streak 1", () => {
    expect(applyReviewResult(item(), "correct", "2026-11-15")).toMatchObject({ box: 2, dueDateVn: "2026-11-18", correctStreak: 1 });
  });
  it("b: box 3, wrong → box 1, due tomorrow, streak 0", () => {
    expect(applyReviewResult(item({ box: 3, correctStreak: 2 }), "wrong", "2026-11-15"))
      .toMatchObject({ box: 1, dueDateVn: "2026-11-16", correctStreak: 0 });
  });
  it("c+d: correct on day 1, 4, 11 → retired after the third", () => {
    let i = applyReviewResult(item(), "correct", "2026-11-15");
    i = applyReviewResult(i, "correct", i.dueDateVn);
    expect(i.status).toBe("active");
    i = applyReviewResult(i, "correct", i.dueDateVn);
    expect(i).toMatchObject({ box: 4, correctStreak: 3, status: "retired" });
  });
  it("e: 'Để sau' keeps box and streak, due tomorrow", () => {
    expect(applyReviewResult(item({ box: 2, correctStreak: 1 }), "skipped", "2026-11-15"))
      .toMatchObject({ box: 2, correctStreak: 1, dueDateVn: "2026-11-16" });
  });
  it("f: 5 due items → the 2 with the lowest box", () => {
    const items = [3, 1, 4, 2, 1].map((box, n) => item({ id: `r${n}`, box: box as ReviewItem["box"], dueDateVn: "2026-11-14" }));
    expect(pickDue(items, "2026-11-15").map((i) => i.id)).toEqual(["r1", "r4"]);
  });
  it("a retired item reopens at box 1 after a real mistake", () => {
    expect(reopenAfterMistake(item({ status: "retired", box: 4, correctStreak: 3 }), "2026-11-20"))
      .toMatchObject({ status: "active", box: 1, correctStreak: 0, dueDateVn: "2026-11-21" });
  });
});

describe("§4.12 máy tính đại số bắt buộc", () => {
  it("a: math_check confirms, checklist closed → self_solved", () => {
    expect(decideSolve({ isGeometryProof: false, checklistOpen: false,
      checks: [{ ok: true, mode: "simplify_check", result: { equivalent: true, fully_simplified: true } }] }))
      .toEqual({ allow: true, status: "self_solved" });
  });
  it("b: no math_check → not allowed", () => {
    expect(decideSolve({ isGeometryProof: false, checklistOpen: false, checks: [] }))
      .toEqual({ allow: false, reason: "no_passing_math_check" });
  });
  it("c: equivalent but a common factor left → not allowed (checklist item 7)", () => {
    expect(decideSolve({ isGeometryProof: false, checklistOpen: false,
      checks: [{ ok: true, mode: "simplify_check", result: { equivalent: true, fully_simplified: false } }] }))
      .toEqual({ allow: false, reason: "not_fully_simplified" });
  });
  it("geometry proof → pending_review (D18)", () => {
    expect(decideSolve({ isGeometryProof: true, checklistOpen: false, checks: [] }))
      .toEqual({ allow: true, status: "pending_review" });
  });
  it("a math_check that errored does not count", () => {
    expect(decideSolve({ isGeometryProof: false, checklistOpen: false,
      checks: [{ ok: false, mode: "equivalent", result: null }] }).allow).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { applyTicks, formatPlan, parsePlanEvent, planEventText, splitPlan, stuckText } from "@/lib/rules/plan";
import { validPlan } from "@/lib/tutor/planCheck";

const STEPS = ["Phân tích 108 ra thừa số nguyên tố", "Phân tích 306 ra thừa số nguyên tố", "Lấy thừa số chung, mũ nhỏ nhất"];

describe("D38: the list of jobs in a tutor message", () => {
  it("round-trips: the tutor's words, then the list", () => {
    const content = `Giờ em làm bài của em nhé.\n\n${formatPlan(STEPS)}`;
    expect(splitPlan(content)).toEqual({ text: "Giờ em làm bài của em nhé.", steps: STEPS });
    expect(splitPlan("Không có danh sách")).toEqual({ text: "Không có danh sách", steps: null });
  });
  it("tick events toggle steps in order", () => {
    expect(parsePlanEvent(planEventText({ step: 2, done: true }))).toEqual({ step: 2, done: true });
    expect(parsePlanEvent("hello")).toBeNull();
    expect(applyTicks([1], [{ step: 2, done: true }, { step: 1, done: false }, { step: 3, done: true }])).toEqual([2, 3]);
  });
  it("the stuck button names the job", () => expect(stuckText(2, STEPS[1]!)).toBe("Em kẹt ở việc 2: Phân tích 306 ra thừa số nguyên tố"));
});

describe("D38: a list the tutor wrote is shown only when it gives nothing away", () => {
  const P = "Tìm ƯCLN(108, 306)";
  it("jobs using only the problem's numbers pass (numbering and bullets removed)", () =>
    expect(validPlan(["1. Phân tích 108 ra thừa số nguyên tố", "- Phân tích 306 ra thừa số nguyên tố", "Nhân lại → ƯCLN"], P))
      .toEqual(["Phân tích 108 ra thừa số nguyên tố", "Phân tích 306 ra thừa số nguyên tố", "Nhân lại → ƯCLN"]));
  it("a job with a result (a new number) refuses the whole list", () =>
    expect(validPlan(["Phân tích 108 = 2² · 3³", "Phân tích 306"], P)).toBeNull());
  it("one job or more than 7 → no list", () => {
    expect(validPlan(["Tìm ƯCLN"], P)).toBeNull();
    expect(validPlan(Array.from({ length: 8 }, () => "Làm một việc"), P)).toBeNull();
    expect(validPlan(null, P)).toBeNull();
  });
});

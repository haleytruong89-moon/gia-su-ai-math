import { describe, expect, it } from "vitest";
import { feedbackRequest, parseMessageRef, shorten } from "@/lib/rules/feedback";

const U = "00000000-0000-4000-8000-000000000001";

describe("parseMessageRef (D32)", () => {
  it("a stored message id", () => expect(parseMessageRef(U)).toEqual({ kind: "id", id: U }));
  it("a reply that arrived in this page", () => expect(parseMessageRef(`${U}-reply`)).toEqual({ kind: "replyTo", clientMsgId: U }));
  it("anything else is refused", () => {
    expect(parseMessageRef("m1")).toBeNull();
    expect(parseMessageRef("x-reply")).toBeNull();
    expect(parseMessageRef("")).toBeNull();
  });
});

describe("feedbackRequest (copy for Claude, no names)", () => {
  it("grade, date, each flagged message with the child's words", () => {
    const text = feedbackRequest(9, "2026-11-22", [
      { problemId: "p1", kind: "gave_answer", tutorText: "Vậy x = 3 nhé", comment: "cô nói luôn đáp số", at: "" },
      { problemId: "p1", kind: "unclear", tutorText: "Em xét Δ", comment: null, at: "" },
    ]);
    expect(text).toBe("Con lớp 9 báo cô sai (2026-11-22), 2 chỗ. Nhờ Claude xem, đưa thành ca test (dữ liệu giả) và sửa:\n"
      + "1. [Cô đưa đáp số] Cô nói: «Vậy x = 3 nhé»\n   Con viết: «cô nói luôn đáp số»\n"
      + "2. [Khó hiểu] Cô nói: «Em xét Δ»");
  });
  it("long tutor text is shortened", () => expect(shorten("a".repeat(400)).length).toBe(300));
});

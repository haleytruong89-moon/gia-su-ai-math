import { describe, expect, it } from "vitest";
import { parseFeedback } from "@/lib/parent/feedbackInput";

const P = "11111111-1111-4111-8111-111111111111";
const M = "22222222-2222-4222-8222-222222222222";

describe("parseFeedback", () => {
  it("accepts a thumb with or without a note (blank note → null)", () => {
    expect(parseFeedback({ problemId: P, messageId: M, thumb: "down", note: " Cô giảng dài quá " }))
      .toEqual({ problemId: P, messageId: M, thumb: "down", note: "Cô giảng dài quá" });
    expect(parseFeedback({ problemId: P, messageId: M, thumb: "up", note: "  " })).toEqual({ problemId: P, messageId: M, thumb: "up", note: null });
    expect(parseFeedback({ problemId: P, messageId: M, thumb: "up" })?.note).toBeNull();
  });
  it("rejects other thumbs, long notes, bad ids, extra fields", () => {
    expect(parseFeedback({ problemId: P, messageId: M, thumb: "meh" })).toBeNull();
    expect(parseFeedback({ problemId: P, messageId: M, thumb: "up", note: "x".repeat(501) })).toBeNull();
    expect(parseFeedback({ problemId: "p1", messageId: M, thumb: "up" })).toBeNull();
    expect(parseFeedback({ problemId: P, messageId: M, thumb: "up", childId: P })).toBeNull();
    expect(parseFeedback(null)).toBeNull();
  });
});

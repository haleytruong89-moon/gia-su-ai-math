import { describe, expect, it } from "vitest";
import { shouldShowRating, type RatingCardInput } from "@/lib/rules/rating";

const base: RatingCardInput = { status: "in_progress", rated: false, earlierEnded: false, skipped: false, endingSession: false };
const show = (o: Partial<RatingCardInput>) => shouldShowRating({ ...base, ...o });

describe("shouldShowRating (P2)", () => {
  it("the first problem ends as self_solved / saved / pending_review → show", () => {
    expect(show({ status: "self_solved" })).toBe(true);
    expect(show({ status: "saved_for_later" })).toBe(true);
    expect(show({ status: "pending_review" })).toBe(true);
  });
  it("still working, abandoned, timed out or off-topic → not yet", () => {
    expect(show({})).toBe(false);
    expect(show({ status: "abandoned" })).toBe(false);
    expect(show({ status: "timed_out" })).toBe(false);
    expect(show({ status: "closed_offtopic" })).toBe(false);
  });
  it("a later problem of the same session → no (the card was offered at the first)", () => expect(show({ status: "self_solved", earlierEnded: true })).toBe(false));
  it("already rated or skipped → never again this session", () => {
    expect(show({ status: "self_solved", rated: true })).toBe(false);
    expect(show({ status: "self_solved", skipped: true })).toBe(false);
    expect(show({ endingSession: true, skipped: true })).toBe(false);
  });
  it("'Kết thúc buổi' opens it when the session is not rated", () => {
    expect(show({ endingSession: true, earlierEnded: true })).toBe(true);
    expect(show({ endingSession: true, rated: true })).toBe(false);
  });
});

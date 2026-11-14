// tests/auth.test.ts
import { describe, expect, it } from "vitest";
import { resolveActor } from "@/lib/actor";

const child = { id: "c1", family_id: "f1", role: "child" as const, grade: 9 };
const teaching = { child_code: "HS-9A", grade: 9, max_lines: 6, version: 2, profile_text: "HỒ SƠ…" };

describe("resolveActor", () => {
  it("child with a current teaching profile", () => {
    expect(resolveActor(child, teaching)).toEqual({
      role: "child", userId: "c1", familyId: "f1", grade: 9, childCode: "HS-9A",
      maxLines: 6, profileVersion: 2, profileText: "HỒ SƠ…",
    });
  });
  it("child without a teaching profile cannot start", () => {
    expect(resolveActor(child, null)).toEqual({ error: "no_teaching_profile" });
  });
  it("parent", () => {
    expect(resolveActor({ id: "p1", family_id: "f1", role: "parent", grade: null }, null))
      .toEqual({ role: "parent", userId: "p1", familyId: "f1" });
  });
  it("grade 7 child is not supported in v1", () => {
    expect(resolveActor({ ...child, grade: 7 }, { ...teaching, grade: 9 })).toEqual({ error: "grade_not_supported" });
  });
});

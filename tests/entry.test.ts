import { describe, expect, it } from "vitest";
import { entryFrom } from "@/lib/entry";
import { resolveActor } from "@/lib/actor";

const child = { id: "c1", family_id: "f1", role: "child" as const, grade: 9 };
const teaching = { child_code: "HS-9A", grade: 9, max_lines: 6, version: 1, profile_text: "HỒ SƠ" };

describe("entryFrom", () => {
  it("no session → signed_out", () => {
    expect(entryFrom(false, { error: "no_profile" })).toEqual({ kind: "signed_out" });
  });
  it("signed in but no Launcher profile → not ready", () => {
    expect(entryFrom(true, resolveActor(null, null))).toEqual({ kind: "child_not_ready", reason: "no_profile" });
  });
  it("child without a teaching profile → not ready (a parent fills it in /gia-su/bo-me)", () => {
    expect(entryFrom(true, resolveActor(child, null))).toEqual({ kind: "child_not_ready", reason: "no_teaching_profile" });
  });
  it("child in grade 7 → not ready", () => {
    expect(entryFrom(true, resolveActor({ ...child, grade: 7 }, teaching))).toEqual({ kind: "child_not_ready", reason: "grade_not_supported" });
  });
  it("child with a profile", () => {
    const e = entryFrom(true, resolveActor(child, teaching));
    expect(e.kind === "child" && e.actor.childCode).toBe("HS-9A");
  });
  it("parent", () => {
    expect(entryFrom(true, resolveActor({ ...child, role: "parent", grade: null }, null))).toEqual({
      kind: "parent", actor: { role: "parent", userId: "c1", familyId: "f1" },
    });
  });
});

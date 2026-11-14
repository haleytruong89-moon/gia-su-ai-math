import { describe, expect, it } from "vitest";
import { parseProfileForm, profileDefaults } from "@/lib/profileForm";

const ok = { childId: "11111111-1111-4111-8111-111111111111", childCode: "HS-9A", profileText: "HỒ SƠ HỌC SINH · mã: HS-9A" };

describe("teaching profile form (DOMAIN §1 teaching_profiles)", () => {
  it("defaults by grade: grade 9 → 6 lines, mixed; grade 6 → 4 lines, buttons first", () => {
    expect(profileDefaults(9)).toEqual({ maxLines: 6, answerMode: "mixed" });
    expect(profileDefaults(6)).toEqual({ maxLines: 4, answerMode: "buttons_first" });
  });
  it("accepts a code like HS-9A and fills the defaults", () => {
    expect(parseProfileForm(ok, 9)).toEqual({ ok: true, value: { ...ok, maxLines: 6, answerMode: "mixed" } });
  });
  it("refuses a real name as the code (public repo, T1: only codes go to the AI)", () => {
    expect(parseProfileForm({ ...ok, childCode: "Tran Van A" }, 9)).toEqual({ ok: false, error: "Chỉ dùng mã dạng HS-9A, không dùng tên thật." });
  });
  it("max lines must stay 2–10", () => {
    expect(parseProfileForm({ ...ok, maxLines: 11 }, 9).ok).toBe(false);
    expect(parseProfileForm({ ...ok, maxLines: "5" }, 9)).toMatchObject({ ok: true, value: { maxLines: 5 } });
  });
  it("profile text: required, at most 4000 characters", () => {
    expect(parseProfileForm({ ...ok, profileText: "   " }, 9)).toEqual({ ok: false, error: "Hồ sơ đang trống." });
    expect(parseProfileForm({ ...ok, profileText: "a".repeat(4001) }, 9)).toEqual({ ok: false, error: "Hồ sơ dài quá 4000 ký tự." });
  });
  it("grade 7 has no tutor in v1", () => {
    expect(parseProfileForm(ok, 7)).toEqual({ ok: false, error: "Gia sư v1 chỉ dành cho lớp 6 và lớp 9." });
  });
});

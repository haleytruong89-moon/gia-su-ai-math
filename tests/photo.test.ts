import { describe, expect, it } from "vitest";
import { deleteAfterVn, misreadCount } from "@/lib/rules/photo";

describe("photo rules", () => {
  const m = (role: "child" | "tutor", text: string) => ({ role, text });
  it("counts 'Sai chỗ…' presses and typed 'sai chỗ …' corrections (DOMAIN §5)", () => {
    expect(misreadCount([m("tutor", "Cô đọc đề là…"), m("child", "Sai chỗ…"), m("tutor", "Cô đọc lại…"), m("child", "sai chỗ số 16")])).toBe(2);
    expect(misreadCount([m("child", "Đúng rồi"), m("tutor", "Sai chỗ nào?")])).toBe(0);
  });
  it("delete_after = Vietnam date + 90 days (23:30 UTC 14/11 is 15/11 in Vietnam) — DOMAIN §4.8", () => {
    expect(deleteAfterVn(new Date("2026-11-14T23:30:00Z"))).toBe("2027-02-13");
    expect(deleteAfterVn(new Date("2026-11-14T10:00:00Z"))).toBe("2027-02-12");
  });
});

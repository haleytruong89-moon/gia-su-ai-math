import { describe, expect, it } from "vitest";
import { loadLayers, promptVersion } from "@/lib/tutor/layers";

describe("prompt layers", () => {
  it("loads ① ② ③ from prompts/", () => {
    const l = loadLayers();
    expect(l.role).toMatch(/^## ① Vai trò/);
    expect(l.rules).toMatch(/^## ② Luật cứng/);
    expect(l.method).toMatch(/^## ③ Phương pháp/);
    expect(l.guard).toContain("Em là bộ kiểm tra");
    expect(l.sibling).toContain("BÀI ANH EM");
  });
  it("rule 1 (never give the original answer) is in the hard rules", () => {
    expect(loadLayers().rules).toContain("Không đưa trọn lời giải hay đáp số của bài gốc");
  });
  it("G8-fix: the figure photo — the tutor names the button; the checker does not ask math_check for a figure", () => {
    const l = loadLayers();
    expect(l.method).toContain("📷 Gửi ảnh");
    expect(l.method).toContain("Không nhắc cùng một ý quá 2 lần");
    expect(l.rules).toContain("de_da_xac_nhan: true");
    expect(l.guard).toContain("không FAIL theo mục 6");
  });
  it("has a version", () => expect(promptVersion()).toMatch(/^v\d+\.\d+$/));
});

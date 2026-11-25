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
    expect(l.guard).toContain("nhận xét **hình vẽ** của em");
  });
  it("G8-fix2 (D35): teach first; the checker answers per rule and gives no verdict; the math checker down", () => {
    const l = loadLayers();
    expect(l.method).toContain("### Giảng trước, hỏi sau");
    expect(l.method).not.toContain("Chỉ hỏi thăm dò để biết em đang ở đâu, chưa gợi ý");
    expect(l.rules).toContain("may_tinh: loi");
    for (const k of ["lo_dap_so", "trach_moc", "khang_dinh_chua_kiem", "bai_anh_em_chua_kiem"]) expect(l.guard).toContain(k);
    expect(l.guard).not.toMatch(/"pass"/);
    expect(l.guard).toContain("Em là bộ kiểm tra"); // the fake client and the tests recognise the checker by this
  });
  it("has a version", () => expect(promptVersion()).toMatch(/^v\d+\.\d+$/));
});

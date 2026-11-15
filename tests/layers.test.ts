import { describe, expect, it } from "vitest";
import { loadLayers, promptVersion } from "@/lib/tutor/layers";

describe("prompt layers", () => {
  it("loads ① ② ③ from prompts/", () => {
    const l = loadLayers();
    expect(l.role).toMatch(/^## ① Vai trò/);
    expect(l.rules).toMatch(/^## ② Luật cứng/);
    expect(l.method).toMatch(/^## ③ Phương pháp/);
    expect(l.guard).toContain("Em là bộ kiểm tra");
  });
  it("rule 1 (never give the original answer) is in the hard rules", () => {
    expect(loadLayers().rules).toContain("Không đưa trọn lời giải hay đáp số của bài gốc");
  });
  it("has a version", () => expect(promptVersion()).toMatch(/^v\d+\.\d+$/));
});

import { describe, expect, it } from "vitest";
import { sanitize } from "@/scripts/knowledge/sanitize";
import { privacyHits } from "@/scripts/knowledge/privacy";

// Made-up fixture shaped like the hub files (no real notes are copied into the repo).
const MD = [
  "# Bản đồ X · v0.2", "> Lập: … ghi chú riêng", "",
  "| Mã | Bài | Lỗi hay gặp | Nền cần | Đề cương HK I |", "|---|---|---|---|---|",
  "| T9.4 | PT quy về PT bậc nhất | 🎯 **thiếu ĐKXĐ** (đã gặp ở HS-9A; barem −0,25) | N8.02 | D1 bài 1 |", "",
  "| Mã | Kiến thức | Lớp | Dùng cho |", "|---|---|---|---|",
  "| N8.02 | Hằng đẳng thức — ⚠️ **HS-9A chưa thuộc** (thầy 14/11) | 8 | T9.4 |", "",
  "## 4. Dạng đề cương HK I ↔ mã KU", "| D1 | T9.2 |", "", "## 5. Lớp ưu tiên", "ok",
].join("\n");

describe("sanitize", () => {
  const out = sanitize(MD, "BAN_DO_X_v0.2.md");
  it("drops the school column, private notes and sections", () => {
    expect(out).toContain("| Mã | Bài | Lỗi hay gặp | Nền cần |\n|---|---|---|---|");
    expect(out).toContain("| T9.4 | PT quy về PT bậc nhất | 🎯 **thiếu ĐKXĐ** | N8.02 |");
    expect(out).toContain("| N8.02 | Hằng đẳng thức | 8 | T9.4 |");
    expect(out).not.toMatch(/đã gặp|barem|thầy|⚠️|Đề cương|D1 bài/);
    expect(out).toContain("## 5. Lớp ưu tiên");
  });
  it("drops private parts of a cell, keeps escaped pipes", () => {
    const t = sanitize("| Mã | Kiến thức | Dùng cho |\n|---|---|---|\n| N7.16 | Đường cao, √(A²) = \\|A\\| | T9.28; **bài giữa kỳ IV.2b2** |", "X");
    expect(t).toContain("| N7.16 | Đường cao, √(A²) = \\|A\\| | T9.28 |");
  });
  it("replaces the header notes with one source line", () => {
    expect(out.split("\n").filter((l) => l.startsWith(">"))).toEqual(
      ["> Nguồn: hub `BAN_DO_X_v0.2.md` (bản sạch cho repo công khai; sinh bằng scripts/knowledge/sanitize.ts)."]);
  });
});

describe("privacyHits", () => {
  it("finds generic private markers and extra terms", () => {
    expect(privacyHits("dòng 1\nlỗi (đã gặp ở HS-9A)").map((h) => h.line)).toEqual([2]);
    expect(privacyHits("Bé Xyz làm bài", ["Xyz"])).toHaveLength(1);
    expect(privacyHits("Tam giác đồng dạng g.g")).toEqual([]);
  });
});

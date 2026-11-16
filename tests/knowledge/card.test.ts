import { describe, expect, it } from "vitest";
import { CARD_MAX, LOOKUP_MAX, checklistFor, knowledgeCard, kuIndex, lookupText } from "@/lib/knowledge/card";
import { codeFitsGrade, knowledgeVersion, unit } from "@/lib/knowledge/load";

describe("knowledge card (layer ⑤)", () => {
  it("T9.9: title, prereq N8.02 with its name, checklist 6 and 7, toolbox ids, within the limit", () => {
    const c = knowledgeCard("T9.9", 9);
    expect(c).toContain("T9.9 · Biến đổi đơn giản và rút gọn biểu thức chứa căn");
    expect(c).toContain("N8.02 Hằng đẳng thức đáng nhớ");
    expect(c).toMatch(/6\. Có câu kết luận cho từng ý/);
    expect(c).toMatch(/7\. Rút gọn đến tận cùng/);
    expect(c).toContain("rutgon.1");
    expect(c).toContain("day_bu_nen");
    expect(c.length).toBeLessThanOrEqual(CARD_MAX);
  });
  it("geometry KU carries the three steps (hinh.0); grade 6 card has the grade 6 checklist", () => {
    expect(knowledgeCard("T9.16", 9)).toContain("Phân tích ngược");
    expect(knowledgeCard("T6.12", 6)).toMatch(/3\. Bài có điều kiện "trong khoảng"/);
    expect(checklistFor("T6.12", 6).map((i) => i.n)).toEqual([1, 2, 3, 5]);
    expect(checklistFor(null, 6).map((i) => i.n)).toEqual([1, 5]);
    expect(checklistFor(null, 9).map((i) => i.n)).toEqual([6]);
    expect(checklistFor("T9.9", 6).map((i) => i.n)).toEqual([1, 5]); // a code of the other grade is ignored
  });
  it("unknown or other-grade code → the unknown card, never throws", () => {
    for (const c of [knowledgeCard("T9.99", 9), knowledgeCard(null, 6), knowledgeCard("T6.12", 9)]) {
      expect(c).toContain("[KIẾN THỨC — chưa xác định]");
      expect(c).toContain("lookup");
    }
  });
  it("every lesson card fits", () => {
    for (const code of [...kuIndex(9).split("\n"), ...kuIndex(6).split("\n")].map((l) => l.split(" ")[0]!)) {
      const g = code.startsWith("T9") ? 9 : 6;
      expect(knowledgeCard(code, g).length, code).toBeLessThanOrEqual(CARD_MAX);
    }
  });
});

describe("lookup text, index, grade filter", () => {
  it("lookup: a background KU, a lesson, a toolbox section, unknown", () => {
    expect(lookupText("N8.02")).toContain("Hằng đẳng thức đáng nhớ");
    expect(lookupText("T9.20")).toContain("Viète");
    const t = lookupText("hinh.1.10")!;
    expect(t).toContain("đồng dạng");
    expect(t.length).toBeLessThanOrEqual(LOOKUP_MAX);
    expect(lookupText("xyz")).toBeNull();
  });
  it("grade filter, index and version", () => {
    expect([codeFitsGrade("N8.02", 9), codeFitsGrade("T6.12", 9), codeFitsGrade("TH.04", 6), codeFitsGrade("T9.77", 9)])
      .toEqual([true, false, true, false]);
    expect(kuIndex(9).split("\n").filter((l) => l.startsWith("T9."))).toHaveLength(32);
    expect(kuIndex(6).split("\n")).toHaveLength(43);
    expect(unit("T9.9")!.title).toContain("rút gọn");
    expect(knowledgeVersion).toMatch(/^\d{4}-\d{2}-\d{2}\.[0-9a-f]{8}$/);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildBundle, type Sources } from "@/scripts/knowledge/build";
import { KnowledgeBundle } from "@/lib/knowledge/schema";

const src = Object.fromEntries(["toan9", "toan6", "hinh9", "rutgon9", "MAP"]
  .map((k) => [k, readFileSync(`knowledge/src/${k}.md`, "utf8")])) as Sources;
const b = buildBundle(src, "2026-11-16");
const ku = (c: string) => b.units.find((u) => u.code === c)!;

// Expected values are read off the curriculum maps (BAN_DO_CHUONG_TRINH) and MAP.md, not from the code.
describe("knowledge build", () => {
  it("is valid and covers both programs", () => {
    expect(() => KnowledgeBundle.parse(b)).not.toThrow();
    expect(b.units.filter((u) => u.grade === 9 && u.level === "bai")).toHaveLength(32);
    expect(b.units.filter((u) => u.grade === 6 && u.level === "bai")).toHaveLength(43);
    expect(b.units.filter((u) => u.level === "nen").map((u) => u.code)).toEqual(expect.arrayContaining(["N7.03", "N8.02", "N8.14", "TH.01", "TH.07"]));
  });
  it("T9.9: chapter, prereqs, roots, checklist 6–7, rút gọn toolbox", () => {
    expect(ku("T9.9")).toMatchObject({ term: "HK1", chapter: "Chương 3. Căn bậc hai và căn bậc ba",
      prereqs: ["T9.7", "T9.8", "N8.02", "N8.05"], checklist: [6, 7] });
    expect(ku("T9.9").errors).toContainEqual({ root: "careful", text: "rút gọn chưa đến tận cùng" });
    expect(ku("T9.9").toolbox).toEqual(["rutgon.0", "rutgon.1", "rutgon.3", "rutgon.4"]);
  });
  it("background unit N8.02, HK II unit T9.20, ranges are expanded", () => {
    expect(ku("N8.02")).toMatchObject({ level: "nen", term: "nen", grade: 9, title: "Hằng đẳng thức đáng nhớ", usedBy: ["T9.4", "T9.5", "T9.9", "T9.19"] });
    expect(ku("T9.20")).toMatchObject({ term: "HK2", prereqs: ["T9.19"] });
    expect(ku("T6.7").prereqs).toEqual(["T6.4", "T6.5", "T6.6"]);
    expect(ku("TH.05").usedBy).toEqual(["T6.23", "T6.24", "T6.25", "T6.26"]);
  });
  it("grade 6: T6.12 checklist 1, 2, 3, 5 and a strategy error; default checklists; proof flags only on geometry", () => {
    expect(ku("T6.12").checklist).toEqual([1, 2, 3, 5]);
    expect(ku("T6.12").errors.map((e) => e.root)).toEqual(["concept", "strategy", "calc"]);
    expect(ku("T6.5").checklist).toEqual([1, 5]);
    expect(ku("T9.1").checklist).toEqual([6]);
    expect(b.defaults).toEqual({ g6: [1, 5], g9: [6] });
    expect([ku("T9.16").proof, ku("T9.9").proof, ku("T6.20").proof]).toEqual([true, false, false]);
  });
  it("checklist texts for both grades", () => {
    expect(b.checklist.filter((c) => c.grade === 9)).toHaveLength(10);
    expect(b.checklist.find((c) => c.grade === 6 && c.n === 3)!.text).toContain("trong khoảng");
  });
  it("toolbox sections exist for every id a unit points to, and hold no worked answers", () => {
    const ids = new Set(b.toolbox.map((t) => t.id));
    expect([...ids]).toEqual(expect.arrayContaining(["hinh.0", "hinh.1.7", "hinh.1.10", "hinh.2.3", "rutgon.0", "rutgon.1", "rutgon.3", "rutgon.4"]));
    for (const u of b.units) for (const t of u.toolbox) expect(ids, `${u.code} → ${t}`).toContain(t);
    for (const t of b.toolbox) expect(t.text.length, t.id).toBeLessThanOrEqual(2200);
    expect(JSON.stringify(b.toolbox)).not.toContain("3/(3 − √x)");
  });
  it("same sources → same version", () => {
    expect(buildBundle(src, "2026-11-16").version).toBe(b.version);
    expect(b.version).toMatch(/^2026-11-16\.[0-9a-f]{8}$/);
  });
});

import { describe, expect, it } from "vitest";
import { cardGaps, type GapEvent } from "@/lib/report/cardGaps";

describe("cardGaps (C5)", () => {
  const ev = (at: string, key: string, kind: GapEvent["kind"] = "the_thieu", childId = "c1") =>
    ({ at, grade: 6 as const, childId, problemId: at, kind, key, statement: "Giảm giá 20% một chiếc áo (đề bịa)" });
  const now = new Date("2026-11-21T12:00:00Z");
  it("twice in 7 days → one gap with a copyable request", () => {
    const g = cardGaps([ev("2026-11-18T10:00:00Z", "lớp 6 – phần trăm"), ev("2026-11-20T10:00:00Z", "Lớp 6 –  phần trăm.")], now, () => false);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ key: "lớp 6 – phần trăm", count: 2, days: ["18/11", "20/11"], childIds: ["c1"] });
    expect(g[0]!.request).toContain("Nhờ soạn thẻ gia sư Toán lớp 6");
    expect(g[0]!.request).toContain("2 lần trong 7 ngày (18/11, 20/11)");
  });
  it("once → nothing; older than 7 days → not counted", () => {
    expect(cardGaps([ev("2026-11-20T10:00:00Z", "a")], now, () => false)).toEqual([]);
    expect(cardGaps([ev("2026-11-14T10:00:00Z", "a"), ev("2026-11-20T10:00:00Z", "a")], now, () => false)).toEqual([]);
    expect(cardGaps([ev("2026-11-15T10:00:00Z", "a"), ev("2026-11-20T10:00:00Z", "a")], now, () => false)).toHaveLength(1);
  });
  it("a no_card gap disappears once the card exists", () => {
    const e = [ev("2026-11-19T10:00:00Z", "T6.13", "no_card"), ev("2026-11-20T10:00:00Z", "T6.13", "no_card")];
    expect(cardGaps(e, now, (c) => c === "T6.13")).toEqual([]);
    expect(cardGaps(e, now, () => false)[0]!.request).toContain("thẻ T6.13");
  });
  it("both children count; most frequent first; het_cach asks for a third way", () => {
    const g = cardGaps([ev("2026-11-19T10:00:00Z", "het_cach:T6.12", "het_cach"), ev("2026-11-20T10:00:00Z", "het_cach:T6.12", "het_cach", "c2"),
      ev("2026-11-21T01:00:00Z", "het_cach:T6.12", "het_cach"), ev("2026-11-19T10:00:00Z", "b"), ev("2026-11-20T10:00:00Z", "b")], now, () => false);
    expect(g.map((x) => [x.key, x.count])).toEqual([["het_cach:T6.12", 3], ["b", 2]]);
    expect(g[0]!.childIds).toEqual(["c1", "c2"]);
    expect(g[0]!.request).toContain("cách giảng thứ 3");
  });
});

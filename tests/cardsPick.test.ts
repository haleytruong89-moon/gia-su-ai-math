import { describe, expect, it } from "vitest";
import { card, cardFromRef, cardIndexText, clashes, pickVariant } from "@/lib/knowledge/cards";
import { cardBlocks, runsOf } from "@/lib/cardBlocks";

describe("clashes (C1: the card's example must use other numbers)", () => {
  it("two key numbers in the problem → clash", () => expect(clashes(["12", "18"], "Tìm BCNN(12, 18) và BC nhỏ hơn 200")).toBe(true));
  it("one shared number only → no clash", () => expect(clashes(["12", "18"], "Ba tàu 10, 12, 15 ngày")).toBe(false));
  it("a single key number clashes when present", () => expect(clashes(["60"], "trong khoảng 60 đến 100")).toBe(true));
  it("numbers inside larger numbers do not count", () => expect(clashes(["12", "18"], "Có 120 và 180 cái")).toBe(false));
  it("fractions are whole tokens", () => expect(clashes(["6", "2/5"], "chảy 6 giờ được 2/5 bể")).toBe(true));
});

describe("pickVariant", () => {
  const c = card("T6.12")!;
  it("way 1 when free; way 2 when way 1 clashes; null when both clash", () => {
    expect(pickVariant(c, 1, "Ba tàu 10, 12, 15 ngày")).toBe(1);
    expect(pickVariant(c, 1, "BCNN(12, 18)?")).toBe(2);
    expect(pickVariant(c, 2, "BCNN(12, 18)?")).toBe(2);
    expect(pickVariant(c, 1, "12, 18, 4 và 6")).toBeNull();
  });
  it("T9.9: the child's x − 16 problem gets way 2 (x − 36)", () =>
    expect(pickVariant(card("T9.9")!, 1, "Rút gọn 1/(√x − 4) + 2/(x − 16)")).toBe(2));
});

describe("cardFromRef / cardIndexText", () => {
  it("parses refs", () => {
    expect(cardFromRef("D6.1#2")).toMatchObject({ card: { code: "D6.1" }, n: 2 });
    expect(cardFromRef("T6.12#3")).toBeNull();
    expect(cardFromRef("T6.99#1")).toBeNull();
    expect(cardFromRef(null)).toBeNull();
  });
  it("lists only the grade's cards (grade 6 never sees T9 cards)", () => {
    const six = cardIndexText(6);
    expect(six).toContain("T6.12 · Bội chung, BCNN");
    expect(six).toContain("D6.1 ·");
    expect(six).not.toContain("T9.9");
    expect(cardIndexText(9)).toContain("D9.1");
  });
});

describe("cardBlocks", () => {
  it("paragraphs, lists, tables; separator rows dropped", () => {
    const b = cardBlocks("**Đề:** một\nhai\n\n- a\n- **b**\n\n| | x |\n|---|---|\n| Vòi I | 1/x |\nsau");
    expect(b.map((x) => x.t)).toEqual(["p", "ul", "table", "p"]);
    expect(b[0]).toEqual({ t: "p", runs: [{ text: "Đề:", bold: true, italic: false }, { text: " một\nhai", bold: false, italic: false }] });
    expect(b[2]).toMatchObject({ t: "table", rows: [[[], [{ text: "x" }]], [[{ text: "Vòi I" }], [{ text: "1/x" }]]] });
  });
  it("*italic* and multiplication signs", () => {
    expect(runsOf("*BCNN gom hết.* Vì")).toEqual([{ text: "BCNN gom hết.", bold: false, italic: true }, { text: " Vì", bold: false, italic: false }]);
    expect(runsOf("2 · 2 · 3")).toEqual([{ text: "2 · 2 · 3", bold: false, italic: false }]);
  });
  it("every approved card renders without stray asterisks", () => {
    for (const code of ["T6.11", "T6.12", "T9.9", "D6.1", "D6.2", "D9.1"]) {
      for (const v of card(code)!.variants) {
        const text = JSON.stringify(cardBlocks(v.body));
        expect(text, `${code}#${v.n}`).not.toContain("*");
      }
    }
  });
});

import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { card, cardFromRef, cardIndexText, clashes, labelClashes, labelsIn, lessonCard, pickVariant, wayClashes } from "@/lib/knowledge/cards";
import { cardBlocks, runsOf } from "@/lib/cardBlocks";

describe("clashes (C1: the card's example must use other numbers)", () => {
  it("two key numbers in the problem → clash", () => expect(clashes(["12", "18"], "Tìm BCNN(12, 18) và BC nhỏ hơn 200")).toBe(true));
  it("one shared number only → no clash", () => expect(clashes(["12", "18"], "Ba tàu 10, 12, 15 ngày")).toBe(false));
  it("a single key number clashes when present", () => expect(clashes(["60"], "trong khoảng 60 đến 100")).toBe(true));
  it("numbers inside larger numbers do not count", () => expect(clashes(["12", "18"], "Có 120 và 180 cái")).toBe(false));
  it("fractions are whole tokens", () => expect(clashes(["6", "2/5"], "chảy 6 giờ được 2/5 bể")).toBe(true));
});

describe("labelClashes (G6d: geometry cards have no numbers, so the point names are compared)", () => {
  it("segment and triangle names, letter order ignored", () =>
    expect(labelsIn("Cho tam giác ABC nhọn, đường cao BE, CF cắt nhau tại H; AE·AC = AF·AB")).toEqual(["ABC", "BE", "CF", "AE", "AC", "AF", "AB"]));
  it("ordinary capitalised words and single letters are not names", () => expect(labelsIn("Cho (O), điểm M. Chứng minh")).toEqual([]));
  it("two shared names → clash; one → no clash", () => {
    expect(labelClashes(["PQR", "PK", "QR"], "Cho tam giác RQP cân tại P, K là trung điểm QR")).toBe(true);
    expect(labelClashes(["PQR", "PK", "QR"], "Cho tam giác ABC, K thuộc QR")).toBe(false);
  });
  it("a typical exam problem does not clash with the geometry method cards", () => {
    for (const code of ["D9.2", "D9.3", "D9.4"]) {
      expect(pickVariant(card(code)!, 1, "Cho tam giác ABC nhọn nội tiếp (O), đường cao BE, CF cắt nhau tại H. Chứng minh BCEF nội tiếp."), code).toBe(1);
    }
  });
  it("wayClashes: numbers or names", () => {
    expect(wayClashes({ keyNumbers: ["12", "18"] }, "BCNN(12, 18)")).toBe(true);
    expect(wayClashes({ keyNumbers: [], keyLabels: ["PQR", "PK"] }, "tam giác PQR, đường PK")).toBe(true);
    expect(wayClashes({ keyNumbers: [], keyLabels: ["PQR", "PK"] }, "tam giác ABC")).toBe(false);
  });
  it("D9.3: a child's problem in P, Q, R, K gets the other way", () =>
    expect(pickVariant(card("D9.3")!, 1, "Cho tam giác PQR cân tại P, K là trung điểm QR. Chứng minh PK là phân giác.")).toBe(2));
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
  it("D37: worked-example cards (C6.*) are listed as such and parse as refs", () => {
    expect(cardIndexText(6)).toContain("C6.1 · Tìm ƯCLN bằng cách liệt kê ước (cách làm — bài mẫu)");
    expect(cardIndexText(6)).toContain("C6.2 · Tìm BCNN bằng cách liệt kê bội (cách làm — bài mẫu)");
    expect(cardFromRef("C6.2#2")).toMatchObject({ card: { code: "C6.2", kind: "cach_lam" }, n: 2 });
    expect(lessonCard("T6.11", 6, [])?.code).toBe("T6.11"); // the fallback lesson card stays a ban_chat card
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
    const codes = readdirSync("knowledge/src/cards").filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
    expect(codes.length).toBeGreaterThan(40);
    for (const code of codes) {
      for (const v of card(code)!.variants) {
        const text = JSON.stringify(cardBlocks(v.body));
        // T6.9 talks about the "dấu *" of a fill-in-the-digit exercise: that star is content.
        expect(text.replace(/dấu \*/g, ""), `${code}#${v.n}`).not.toContain("*");
        expect(v.body, `${code}#${v.n}: code fences and quotes are not rendered`).not.toMatch(/^(```|> )/m);
      }
    }
  });
});

describe("lessonCard (D36: the lesson's approved card instead of a safe line)", () => {
  it("the 'ban_chat' card of the lesson, right grade, not shown yet in this problem", () => {
    expect(lessonCard("T6.11", 6, [])?.code).toBe("T6.11");
    expect(lessonCard("T9.16", 9, [])?.code).toBe("T9.16");
  });
  it("never a reading card (doc_de, e.g. D6.1 is also about T6.11), never the other grade, never twice", () => {
    expect(lessonCard("T6.11", 6, [])?.kind).toBe("ban_chat");
    expect(lessonCard("T6.11", 9, [])).toBeNull();
    expect(lessonCard("T6.11", 6, ["T6.11"])).toBeNull();
  });
  it("no lesson, or a lesson without a card → null", () => {
    expect(lessonCard(null, 6, [])).toBeNull();
    expect(lessonCard("N8.02", 9, [])).toBeNull();
  });
});

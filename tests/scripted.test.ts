import { describe, expect, it } from "vitest";
import { lastCardOf, scriptedTurn } from "@/lib/tutor/scripted";
import { BTN_CARD_AGAIN, BTN_NOT_UNDERSTAND_PROBLEM, DOC_DE_BUTTONS } from "@/lib/copy";

const base = { kind: "button" as const, grade: 6 as const, lastCard: null, problemText: "Ba tàu cập bến 10 ngày, 12 ngày, 15 ngày một lần" };

describe("scriptedTurn (Y3: no model call)", () => {
  it("'Em không hiểu đề' → the diagnosis question (3 buttons for grade 6, 4 for grade 9)", () => {
    expect(scriptedTurn({ ...base, text: BTN_NOT_UNDERSTAND_PROBLEM }))
      .toEqual({ kind: "doc_de_ask", message: "Em vướng ở chỗ nào?", buttons: DOC_DE_BUTTONS.slice(0, 3) });
    expect(scriptedTurn({ ...base, grade: 9, text: BTN_NOT_UNDERSTAND_PROBLEM })?.buttons).toHaveLength(4);
  });
  it("'Giảng lại cách khác' after way 1 → way 2 of the same card", () =>
    expect(scriptedTurn({ ...base, text: BTN_CARD_AGAIN, lastCard: { code: "T6.12", n: 1 } }))
      .toEqual({ kind: "card", message: "Cô giảng cách khác nhé:", cardRef: "T6.12#2", buttons: ["Em hiểu rồi", "Giảng lại cách khác"] }));
  it("after way 2 → offer to save; names the gap (C2, C5)", () =>
    expect(scriptedTurn({ ...base, text: BTN_CARD_AGAIN, lastCard: { code: "T6.12", n: 2 } }))
      .toMatchObject({ kind: "cards_done", buttons: ["Để dành hỏi thầy", "Em thử lại"], gap: "het_cach:T6.12" }));
  it("the other way clashes with the child's numbers → also done", () => {
    const way2 = scriptedTurn({ ...base, text: BTN_CARD_AGAIN, lastCard: { code: "T6.12", n: 1 } });
    expect(way2?.kind).toBe("card");
    // way 2 of T6.12 uses 4 and 6 (see knowledge/src/cards/T6.12.md)
    expect(scriptedTurn({ ...base, text: BTN_CARD_AGAIN, lastCard: { code: "T6.12", n: 1 }, problemText: "Hai đèn nháy 4 giây và 6 giây" })?.kind)
      .toBe("cards_done");
  });
  it("typed text, other buttons, unknown cards → the model", () => {
    expect(scriptedTurn({ ...base, kind: "text", text: BTN_NOT_UNDERSTAND_PROBLEM })).toBeNull();
    expect(scriptedTurn({ ...base, text: "Em hiểu rồi", lastCard: { code: "T6.12", n: 1 } })).toBeNull();
    expect(scriptedTurn({ ...base, text: BTN_CARD_AGAIN })).toBeNull();
    expect(scriptedTurn({ ...base, text: BTN_CARD_AGAIN, lastCard: { code: "T6.99", n: 1 } })).toBeNull();
  });
});

describe("lastCardOf", () => {
  it("newest tutor card of the thread", () => {
    expect(lastCardOf([{ role: "tutor", cardRef: "T6.12#1" }, { role: "child" }, { role: "tutor", cardRef: "T6.12#2" }, { role: "tutor", cardRef: null }]))
      .toEqual({ code: "T6.12", n: 2 });
    expect(lastCardOf([{ role: "tutor" }])).toBeNull();
  });
});

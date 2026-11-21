import { describe, expect, it } from "vitest";
import { gradeExact, normalizeAnswer, reviewItemsFromCard } from "@/lib/rules/review";
import { card } from "@/lib/knowledge/cards";

describe("gradeExact", () => {
  it("ignores case, spaces, a final dot, Unicode form", () => {
    expect(gradeExact("  bcnn. ", "BCNN")).toBe(true);
    expect(gradeExact("Để chia hết cho mọi số đã cho", "Để  chia hết cho mọi số đã cho")).toBe(true);
    expect(gradeExact("Đ".normalize("NFD") + "ể", "Để")).toBe(true);
    expect(gradeExact("ƯCLN", "BCNN")).toBe(false);
    expect(gradeExact("", "BCNN")).toBe(false);
  });
  it("normalizeAnswer", () => expect(normalizeAnswer("  A  b.  ")).toBe("a b"));
});

describe("reviewItemsFromCard (Y2)", () => {
  it("every question of the card, box 1, due tomorrow, active, source card", () => {
    const c = card("T6.12")!;
    const items = reviewItemsFromCard(c, "2026-11-21");
    expect(items).toHaveLength(c.review.length);
    expect(items[0]).toMatchObject({ cardCode: "T6.12", kuCode: "T6.12", box: 1, dueDateVn: "2026-11-22", status: "active", source: "card",
      itemKey: c.review[0]!.key, prompt: c.review[0]!.prompt, answer: c.review[0]!.answer, answerCheck: c.review[0]!.check });
  });
  it("a đọc-đề card files its questions under its lesson (D6.1 → T6.11)", () =>
    expect(reviewItemsFromCard(card("D6.1")!, "2026-11-30")[0]).toMatchObject({ cardCode: "D6.1", kuCode: "T6.11", dueDateVn: "2026-12-01" }));
});

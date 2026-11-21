import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCards, parseCardMd } from "../scripts/knowledge/cards";

const md = readFileSync("knowledge/src/cards/T6.11.md", "utf8");

describe("parseCardMd (G6 design C)", () => {
  it("reads the header, two ways (body verbatim, key numbers, checks) and the review questions", () => {
    const c = parseCardMd(md);
    expect(c).toMatchObject({ code: "T6.11", grade: 6, kind: "ban_chat", ku: "T6.11", title: "Ước chung, ƯCLN" });
    expect(c.variants.map((v) => [v.n, v.title, v.keyNumbers])).toEqual([[1, "Chia quà vào túi", ["12", "18"]], [2, "Cắt dây thành đoạn bằng nhau", ["24", "36"]]]);
    expect(c.variants[0].body.startsWith("**Ví dụ.**")).toBe(true);
    expect(c.variants[0].body).not.toMatch(/^(số|kiểm):/m);
    expect(c.variants[0].checks).toContain("gcd(12, 18) == 6");
    expect(c.review.map((q) => [q.key, q.kind, q.check])).toEqual([["why1", "why", "exact"], ["rec1", "recognize", "exact"]]);
    expect(c.review[1]!.buttons).toEqual(["ƯCLN", "BCNN", "Phân số"]);
  });
  it("a typed math_check question has no buttons (T9.9)", () => {
    const c = parseCardMd(readFileSync("knowledge/src/cards/T9.9.md", "utf8"));
    expect(c.review.find((q) => q.key === "mini1")).toMatchObject({ kind: "mini_problem", check: "math_check", buttons: [], answer: "sqrt(x) + 5" });
  });
  it("an exact answer that is not a button is refused", () =>
    expect(() => parseCardMd(md.replace("answer: ƯCLN", "answer: không có trong nút"))).toThrow(/one of the buttons/));
  it("one way only is refused (C2: 2 ways)", () =>
    expect(() => parseCardMd(md.replace(/## Cách 2[\s\S]*?(?=## Câu ôn)/, ""))).toThrow(/2 ways/));
  it("a way without its numbers line is refused (needed for the clash check)", () =>
    expect(() => parseCardMd(md.replace("số: 24, 36\n", ""))).toThrow());
  it("no review section is refused", () => expect(() => parseCardMd(md.replace(/## Câu ôn[\s\S]*$/, ""))).toThrow(/Câu ôn/));
});

describe("buildCards", () => {
  it("sorted by code, version = date + hash, deterministic", () => {
    const files = { "T6.12.md": readFileSync("knowledge/src/cards/T6.12.md", "utf8"), "T6.11.md": md };
    const a = buildCards(files, "2026-11-21");
    expect(a.cards.map((c) => c.code)).toEqual(["T6.11", "T6.12"]);
    expect(a.version).toMatch(/^2026-11-21\.[0-9a-f]{8}$/);
    expect(buildCards(files, "2026-11-21").version).toBe(a.version);
  });
  it("a duplicate code is refused; the file name is in the error", () => {
    expect(() => buildCards({ "a.md": md, "b.md": md }, "2026-11-21")).toThrow(/duplicate card T6.11/);
    expect(() => buildCards({ "bad.md": "nope" }, "2026-11-21")).toThrow(/bad\.md/);
  });
});

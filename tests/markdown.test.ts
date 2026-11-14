import { describe, expect, it } from "vitest";
import { lines } from "@/lib/markdown";

describe("tutor message rendering (no HTML from the model ever reaches the page)", () => {
  it("splits lines and **bold** runs", () => {
    expect(lines("Tử còn **phân tích** tiếp được không?\nEm thử xem.")).toEqual([
      [{ text: "Tử còn ", bold: false }, { text: "phân tích", bold: true }, { text: " tiếp được không?", bold: false }],
      [{ text: "Em thử xem.", bold: false }],
    ]);
  });
  it("keeps HTML as plain text", () => {
    expect(lines("<b>x</b>")).toEqual([[{ text: "<b>x</b>", bold: false }]]);
  });
  it("an unclosed ** stays as typed", () => {
    expect(lines("2 ** 3")).toEqual([[{ text: "2 ** 3", bold: false }]]);
  });
});

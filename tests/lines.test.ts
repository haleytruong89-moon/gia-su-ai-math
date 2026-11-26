import { describe, expect, it } from "vitest";
import { linesAllowed, messageLines, sampleChecked } from "@/lib/tutor/lines";
import type { ToolRecord } from "@/lib/tools/defs";

const sib = (output: object): ToolRecord => ({ tool: "make_sibling", input: {}, output, ok: true, ms: 1, round: 0 });

describe("D37: room for the opening lesson", () => {
  it("counts non-empty lines", () => expect(messageLines("a\n\nb\n  \n c ")).toBe(3));
  it("the ways to solve get 8 lines; a checked worked example 16; anything else the profile's limit", () => {
    expect(linesAllowed({ ky_thuat: "cac_cach" }, false, 4)).toBe(8);
    expect(linesAllowed({ ky_thuat: "bai_mau" }, true, 6)).toBe(16);
    expect(linesAllowed({ ky_thuat: "bai_mau" }, false, 6)).toBe(6); // no machine-checked sibling → no extra room
    expect(linesAllowed({ ky_thuat: "thuong" }, true, 6)).toBe(6);
    expect(linesAllowed({ ky_thuat: "cac_cach" }, false, 10)).toBe(10);
  });
  it("a sibling counts only when verified with other numbers", () => {
    expect(sampleChecked([sib({ verified: true, numbers_differ: true })])).toBe(true);
    expect(sampleChecked([sib({ verified: true, numbers_differ: false })])).toBe(false);
    expect(sampleChecked([])).toBe(false);
  });
});

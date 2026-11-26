import { describe, expect, it } from "vitest";
import { runLookup } from "@/lib/tools/lookup";
import { TOOL_DEFS } from "@/lib/tools/defs";
import { toolSummary } from "@/lib/tutor/handlers";
import { toolKeys } from "@/eval/checks";

describe("lookup tool", () => {
  it("known code, unknown code, bad input", () => {
    expect(runLookup({ code: "N8.02" })).toMatchObject({ ok: true, output: { text: expect.stringContaining("Hằng đẳng thức") } });
    // D38: a card code is answered with "use the_hien" (the tutor wrote its own example after a not_found).
    expect(runLookup({ code: "C6.1" })).toMatchObject({ ok: true, output: { text: expect.stringContaining('the_hien = "C6.1"') } });
    expect(runLookup({ code: "T6.11" })).toMatchObject({ ok: true, output: { text: expect.not.stringContaining("the_hien") } });
    expect(runLookup({ code: " hinh.1.7 " })).toMatchObject({ ok: true });
    expect(runLookup({ code: "xyz" })).toEqual({ ok: false, output: { error: "not_found" } });
    expect(runLookup({})).toEqual({ ok: false, output: { error: "bad_input" } });
  });
  it("is offered to the model; the checker and the eval see it", () => {
    expect(TOOL_DEFS.map((t) => t.name)).toContain("lookup");
    const rec = { tool: "lookup" as const, input: { code: "N8.02" }, output: { text: "…" }, ok: true, ms: 1, round: 0 };
    expect(toolSummary(rec)).toBe("lookup(N8.02 → ok)");
    expect(toolSummary({ ...rec, input: { code: "x" }, output: { error: "not_found" }, ok: false })).toBe("lookup(x → error: not_found)");
    expect(toolKeys(rec)).toEqual(["lookup", "lookup:N8.02"]);
  });
});

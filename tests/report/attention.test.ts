import { describe, expect, it } from "vitest";
import { attentionLines } from "@/lib/report/attention";
import type { Flag } from "@/lib/report/flags";

const f = (kind: Flag["kind"], text: string = kind): Flag => ({ kind, text, problemIds: [] });

describe("attentionLines (X1: the first two flags, Launcher keeps 2 lines)", () => {
  it("keeps the first two in priority order", () =>
    expect(attentionLines([f("cas_loi"), f("y_chan"), f("nan_bo_do")])).toEqual(["cas_loi", "y_chan"]));
  it("nothing → nothing", () => expect(attentionLines([])).toEqual([]));
  it("cuts a long line at 160 characters with an ellipsis", () => {
    const [line] = attentionLines([f("lo_hong_nen", "x".repeat(300))]);
    expect(line).toHaveLength(160);
    expect(line!.endsWith("…")).toBe(true);
  });
});

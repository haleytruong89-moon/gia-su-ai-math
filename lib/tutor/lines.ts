// lib/tutor/lines.ts — how the app counts the lines of a tutor message (max_lines rule).
import type { ToolRecord } from "@/lib/tools/defs";
import { usableSibling } from "@/lib/tutor/repo";

export const messageLines = (m: string) => m.split("\n").filter((l) => l.trim().length > 0).length;

/** A make_sibling call of this turn gave a worked example the machine checked (verified, other numbers). */
export const sampleChecked = (tools: readonly ToolRecord[]): boolean =>
  tools.some((t) => t.tool === "make_sibling" && t.ok && usableSibling(t.output));

/**
 * D37: how many lines this answer may have. The opening lesson needs more room than a hint: the ways to solve the
 * type (cac_cach) get 8 lines, a worked example the machine checked (bai_mau + make_sibling) gets 16. Else the
 * profile's max_lines.
 */
export function linesAllowed(o: { ky_thuat: string }, sampleOk: boolean, base: number): number {
  if (o.ky_thuat === "bai_mau" && sampleOk) return Math.max(base, 16);
  if (o.ky_thuat === "cac_cach") return Math.max(base, 8);
  return base;
}

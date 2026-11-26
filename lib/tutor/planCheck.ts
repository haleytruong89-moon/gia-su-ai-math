// lib/tutor/planCheck.ts — a list of jobs the tutor wrote (D38) is shown only when it cannot give anything away.
import { numbersIn } from "@/lib/tools/makeSibling";
import { MAX_STEPS } from "@/lib/rules/plan";

/**
 * 2–7 short jobs; every number in them is a number of the problem (a result of a step would be a new number:
 * "108 = 2² · 3³" is refused, "Phân tích 108 ra thừa số nguyên tố" passes). Anything else → no list (null).
 */
export function validPlan(steps: readonly string[] | null | undefined, problemText: string): string[] | null {
  if (!steps) return null;
  const clean = steps.map((s) => s.replace(/\s+/g, " ").trim().replace(/^(?:\d+[.)]|[-•☐✓])\s*/, "")).filter((s) => s.length >= 3);
  if (clean.length < 2 || clean.length > MAX_STEPS || clean.some((s) => s.length > 120)) return null;
  const allowed = new Set(numbersIn(problemText));
  return clean.every((s) => numbersIn(s).every((n) => allowed.has(n))) ? clean : null;
}

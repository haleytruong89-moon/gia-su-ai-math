/** When may a problem become self_solved? (DOMAIN §3.2, §4.4, §4.12) */

export interface MathCheckRecord {
  ok: boolean; // the tool ran without error
  mode: string;
  result: Record<string, unknown> | null;
}

export type GateDecision =
  | { allow: true; status: "self_solved" | "pending_review" }
  | { allow: false; reason: "proof_goes_to_review" | "no_passing_math_check" | "not_fully_simplified" | "checklist_open" };

/**
 * The model proposes `ket_qua_bai = self_solved`; the server decides.
 * - geometry proofs never self-solve: pending_review (D18)
 * - otherwise at least one math_check in this problem must confirm the child's final answer
 *   (equivalent / is_root / satisfies, and fully_simplified when simplified), and the checklist must be closed.
 */
export function decideSolve(input: {
  isGeometryProof: boolean;
  checks: readonly MathCheckRecord[];
  checklistOpen: boolean;
}): GateDecision {
  if (input.isGeometryProof) return { allow: true, status: "pending_review" };
  const passing = input.checks.filter((c) => c.ok && c.result);
  const confirmed = passing.some(
    // equivalent / simplify_check, check_root, check_solution (systems, G4)
    (c) => c.result?.["equivalent"] === true || c.result?.["is_root"] === true || c.result?.["satisfies"] === true,
  );
  if (!confirmed) return { allow: false, reason: "no_passing_math_check" };
  const simplify = passing.filter((c) => c.mode === "simplify_check").at(-1);
  if (simplify && simplify.result?.["fully_simplified"] === false) {
    return { allow: false, reason: "not_fully_simplified" };
  }
  if (input.checklistOpen) return { allow: false, reason: "checklist_open" };
  return { allow: true, status: "self_solved" };
}

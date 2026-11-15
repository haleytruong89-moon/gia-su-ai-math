// lib/rules/outcome.ts — the problem's status after a turn. The model proposes, the server decides.
import { decideSolve } from "@/lib/rules/solveGate";
import type { ProblemStatus } from "@/lib/tutor/repo";
import type { TutorOutput } from "@/lib/tutor/schema";

/** D15: at most 20 turns per problem; turn 20 closes it. */
export const MAX_TURNS = 20;
/** DOMAIN §5: the third off-topic turn in a problem closes it. */
export const OFFTOPIC_CLOSE_AT = 3;

export interface OutcomeInput { turn: number; output: TutorOutput | null; submitted: boolean; offtopicCount: number }
export interface Outcome { status: ProblemStatus; offtopicCount: number; solveBlocked: string | null }

export function decideOutcome(i: OutcomeInput): Outcome {
  const offtopicCount = i.offtopicCount + (i.output?.flags.includes("off_topic") ? 1 : 0);
  if (offtopicCount >= OFFTOPIC_CLOSE_AT) return { status: "closed_offtopic", offtopicCount, solveBlocked: null };
  let status: ProblemStatus = "in_progress";
  let solveBlocked: string | null = null;
  const proposed = i.output?.ket_qua_bai;
  const proof = i.output?.flags.includes("geometry_proof") ?? false;
  if ((proposed === "self_solved" || proposed === "pending_review") && i.submitted) {
    // G2 has no math_check yet: checks = [] → only a geometry proof can leave (to review). G4 passes the tool log.
    const gate = decideSolve({ isGeometryProof: proof, checks: [], checklistOpen: false });
    if (gate.allow) status = gate.status;
    else solveBlocked = gate.reason;
  } else if (proposed === "self_solved") {
    solveBlocked = "no_passing_math_check";
  }
  if (status === "in_progress" && i.turn >= MAX_TURNS) status = "timed_out";
  return { status, offtopicCount, solveBlocked };
}

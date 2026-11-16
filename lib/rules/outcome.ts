// lib/rules/outcome.ts — the problem's status after a turn. The model proposes, the server decides.
import { decideSolve, type MathCheckRecord } from "@/lib/rules/solveGate";
import type { ToolRecord } from "@/lib/tools/defs";
import type { ProblemStatus } from "@/lib/tutor/repo";
import type { TutorOutput } from "@/lib/tutor/schema";

/** D15: at most 20 turns per problem; turn 20 closes it. */
export const MAX_TURNS = 20;
/** DOMAIN §5: the third off-topic turn in a problem closes it. */
export const OFFTOPIC_CLOSE_AT = 3;

export interface OutcomeInput {
  turn: number; output: TutorOutput | null; submitted: boolean; offtopicCount: number;
  /** math_check calls of the answer the child sees this turn (the submitted answer is checked here) */
  checks?: readonly MathCheckRecord[];
  /** G4 Q2 (phụ huynh chốt 15/11): grade 9 needs ≥ 1 checklist item (§4.10) asked before self_solved */
  checklistRequired?: boolean;
  /** checklist items asked in this problem so far, this answer included */
  checklistAsked?: readonly number[];
}

/** The math_check calls of a tool log, in the shape the solve gate reads. */
export function checksFrom(tools: readonly ToolRecord[]): MathCheckRecord[] {
  return tools.filter((t) => t.tool === "math_check").map((t) => {
    const out = t.output as { ok?: boolean; result?: Record<string, unknown> } | null;
    const mode = (t.input as { mode?: unknown } | null)?.mode;
    return { ok: t.ok && out?.ok === true, mode: typeof mode === "string" ? mode : "", result: out?.ok ? (out.result ?? null) : null };
  });
}
export interface Outcome { status: ProblemStatus; offtopicCount: number; solveBlocked: string | null }

export function decideOutcome(i: OutcomeInput): Outcome {
  const offtopicCount = i.offtopicCount + (i.output?.flags.includes("off_topic") ? 1 : 0);
  if (offtopicCount >= OFFTOPIC_CLOSE_AT) return { status: "closed_offtopic", offtopicCount, solveBlocked: null };
  let status: ProblemStatus = "in_progress";
  let solveBlocked: string | null = null;
  const proposed = i.output?.ket_qua_bai;
  const proof = i.output?.flags.includes("geometry_proof") ?? false;
  if ((proposed === "self_solved" || proposed === "pending_review") && i.submitted) {
    // DOMAIN §4.12: only a passing math_check of this (submitted) answer lets a calculation problem close.
    const checklistOpen = (i.checklistRequired ?? false) && (i.checklistAsked ?? []).length === 0;
    const gate = decideSolve({ isGeometryProof: proof, checks: i.checks ?? [], checklistOpen });
    if (gate.allow) status = gate.status;
    else solveBlocked = gate.reason;
  } else if (proposed === "self_solved") {
    solveBlocked = "no_passing_math_check";
  }
  if (status === "in_progress" && i.turn >= MAX_TURNS) status = "timed_out";
  return { status, offtopicCount, solveBlocked };
}

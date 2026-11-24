// lib/report/facts.ts — database rows of one child's day → the facts the evening flags need. Pure.
import { flagsOf, type ProblemStatus } from "@/lib/tutor/repo";
import type { DayFacts, ProblemFacts } from "./flags";

export interface ProblemRowLite {
  id: string; session_id: string; status: ProblemStatus; hint_level_max: number; nan_jumps: number; u_level: 0 | 1 | 2 | 3;
  ku_code: string | null; exam_slot: string | null; prereq_gaps: string[] | null; confirmed_statement: string | null; created_at: string;
}
export interface CallRowLite {
  problem_id: string | null; purpose: string; guard_result: string | null; raw_output: string | null;
  /** G8-fix: why the checker blocked an answer (only on tutor calls it blocked). */
  guard_reasons?: string[] | null;
}
export interface ToolRowLite { problem_id: string | null; tool: string; output: unknown }

/** The algebra service itself failed (timeout, unreachable, HTTP error, crash) — not a bad input from the model. */
export function isCasFailure(output: unknown): boolean {
  const o = output as { ok?: unknown; error?: unknown } | null;
  if (!o || o.ok !== false || typeof o.error !== "string") return false;
  return /^(timeout|cas_unreachable|cas_http_\d+|cas_bad_reply|cas_not_configured|internal:)/.test(o.error);
}

function classifiedProof(raw: string | null): boolean {
  try {
    return (JSON.parse(raw ?? "") as { geometry_proof?: unknown }).geometry_proof === true;
  } catch {
    return false;
  }
}

export function factsFromRows(a: {
  problems: ProblemRowLite[]; calls: CallRowLite[]; tools: ToolRowLite[]; sessionsAbandoned: number; ratings: { face: string }[];
  /** G8-fix: the tutor messages of the day that were a pre-written safe line (DOMAIN §5: the checker blocked twice). */
  safeLines?: { problem_id: string | null }[];
}): DayFacts {
  const problems: ProblemFacts[] = a.problems.map((p) => {
    const calls = a.calls.filter((c) => c.problem_id === p.id);
    const geometryProof = calls.some((c) =>
      (c.purpose === "classify" && classifiedProof(c.raw_output)) || (c.purpose === "tutor" && flagsOf(c.raw_output ?? "").includes("geometry_proof")));
    return {
      id: p.id, status: p.status, hintLevelMax: p.hint_level_max, nanJumps: p.nan_jumps, uLevel: p.u_level,
      kuCode: p.ku_code, examSlot: p.exam_slot, prereqGaps: p.prereq_gaps ?? [], geometryProof,
      rewrittenCount: calls.filter((c) => c.purpose === "tutor" && c.guard_result === "rewritten").length,
      safeLineCount: (a.safeLines ?? []).filter((m) => m.problem_id === p.id).length,
      blockReasons: calls.filter((c) => c.purpose === "tutor" && c.guard_result === "blocked").flatMap((c) => c.guard_reasons ?? []),
      referenceMismatch: calls.some((c) => c.purpose === "reference" && c.guard_result === "blocked"),
    };
  });
  return {
    problems,
    sessionsAbandoned: a.sessionsAbandoned,
    ratingsHard: a.ratings.filter((r) => r.face === "hard").length,
    casErrors: a.tools.filter((t) => t.tool === "math_check" && isCasFailure(t.output)).length,
  };
}

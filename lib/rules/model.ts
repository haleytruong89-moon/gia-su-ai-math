// lib/rules/model.ts — which model answers this turn (DOMAIN §4.14, D28, D29). Pure; the model never chooses.
import type { HintLevel } from "@/lib/rules/hints";

export type ModelTier = "main" | "strong";
export type RouteReason =
  | "guard_blocked" | "nan" | "hint_h3" | "tutor_unsure" | "sticky" | "geometry_proof" | "exam_slot_hard" | "opus_paused";
export interface RouteInput {
  grade: 6 | 9; hintLevel: HintLevel; nan: boolean; prevTutorUnsure: boolean;
  problemUsedStrong: boolean; strongPaused: boolean;
  /** From G5 (knowledge layer): the app knows the problem type. */
  geometryProof?: boolean; examSlot?: string | null;
}

/** D29: from this monthly spend the app stops escalating to Opus (Sonnet keeps running). */
export const STRONG_PAUSE_AT_USD = 45;
const HARD_SLOTS = new Set(["HN10-2c", "HN10-3c", "HN10-4b", "HN10-4c", "HN10-5"]);

export const strongPaused = (u: { costUsd: number; mode: "normal" | "economy" }) =>
  u.mode === "economy" || u.costUsd >= STRONG_PAUSE_AT_USD;

function signal(i: RouteInput): RouteReason | null {
  if (i.nan) return "nan";
  if (i.hintLevel >= 3) return "hint_h3";
  if (i.prevTutorUnsure) return "tutor_unsure";
  if (i.grade === 9 && i.geometryProof) return "geometry_proof";
  if (i.grade === 9 && i.examSlot && HARD_SLOTS.has(i.examSlot)) return "exam_slot_hard";
  return null;
}

/** Order: paused → Sonnet; problem already on Opus → Opus (kept to the end); any signal → Opus; else Sonnet. */
export function pickModel(i: RouteInput): { tier: ModelTier; reason: RouteReason | null } {
  const s = signal(i);
  if (i.strongPaused) return { tier: "main", reason: s || i.problemUsedStrong ? "opus_paused" : null };
  if (i.problemUsedStrong) return { tier: "strong", reason: "sticky" };
  return s ? { tier: "strong", reason: s } : { tier: "main", reason: null };
}

/**
 * A blocked answer is rewritten on the model of the turn, Sonnet while Opus is paused (§4.14 d, §5).
 * D36 (25/11): it used to go to Opus, and the Opus rewrite then made the whole problem sticky — in real use 84% of
 * the cost and 15–25 s a turn, for answers that were mostly blocked by mistake.
 */
export function rewriteRoute(strongPausedNow: boolean, tier: ModelTier): { tier: ModelTier; reason: RouteReason } {
  return strongPausedNow ? { tier: "main", reason: "opus_paused" } : { tier, reason: "guard_blocked" };
}

// lib/rules/rating.ts — when the child sees the "chấm cô" card (US6; plan G7 P2, chốt 18/11). Pure.
import { RATING_OUTCOMES, type ProblemStatus } from "@/lib/tutor/repo";

export interface RatingCardInput {
  status: ProblemStatus;
  rated: boolean;
  /** another problem of this session already ended with a rating outcome (the card was offered then) */
  earlierEnded: boolean;
  /** the child pressed "Bỏ qua" on this session's card */
  skipped: boolean;
  /** the child pressed "Kết thúc buổi" */
  endingSession: boolean;
}

/** After the FIRST problem of the session ends (self_solved / saved / pending_review), or on "Kết thúc buổi"; once per session. */
export function shouldShowRating(a: RatingCardInput): boolean {
  if (a.rated || a.skipped) return false;
  return a.endingSession || (!a.earlierEnded && RATING_OUTCOMES.includes(a.status));
}

export const FACES = [
  { face: "easy", emoji: "🙂", label: "Dễ hiểu" },
  { face: "ok", emoji: "😐", label: "Bình thường" },
  { face: "hard", emoji: "😕", label: "Khó hiểu" },
] as const;

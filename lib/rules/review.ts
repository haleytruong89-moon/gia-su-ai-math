/** Spaced review at the start of a session (DOMAIN §3.6, §4.11, D26). */
import { addDays } from "@/lib/time";

export type ReviewStatus = "active" | "paused" | "retired";
export type ReviewResult = "correct" | "wrong" | "skipped";

export interface ReviewItem {
  id: string;
  box: 1 | 2 | 3 | 4;
  dueDateVn: string; // YYYY-MM-DD
  correctStreak: number;
  status: ReviewStatus;
}

/** Days until the next ask, keyed by the NEW box after a correct answer. */
const INTERVAL_BY_BOX: Record<2 | 3 | 4, number> = { 2: 3, 3: 7, 4: 7 };
export const MAX_PER_SESSION = 2;
export const STREAK_TO_RETIRE = 3;

export function applyReviewResult(item: ReviewItem, result: ReviewResult, todayVn: string): ReviewItem {
  if (result === "skipped") return { ...item, dueDateVn: addDays(todayVn, 1) };
  if (result === "wrong") return { ...item, box: 1, correctStreak: 0, dueDateVn: addDays(todayVn, 1) };
  const box = Math.min(4, item.box + 1) as 2 | 3 | 4;
  const correctStreak = item.correctStreak + 1;
  return {
    ...item,
    box,
    correctStreak,
    dueDateVn: addDays(todayVn, INTERVAL_BY_BOX[box]),
    status: correctStreak >= STREAK_TO_RETIRE ? "retired" : item.status,
  };
}

/** Up to 2 active items due today or earlier: lowest box first, then the oldest due date. */
export function pickDue(items: readonly ReviewItem[], todayVn: string, max = MAX_PER_SESSION): ReviewItem[] {
  return items
    .filter((i) => i.status === "active" && i.dueDateVn <= todayVn)
    .sort((a, b) => a.box - b.box || a.dueDateVn.localeCompare(b.dueDateVn) || a.id.localeCompare(b.id))
    .slice(0, max);
}

/** A real mistake on a retired KU reopens its review item at box 1, due tomorrow. */
export function reopenAfterMistake(item: ReviewItem, todayVn: string): ReviewItem {
  if (item.status !== "retired") return item;
  return { ...item, status: "active", box: 1, correctStreak: 0, dueDateVn: addDays(todayVn, 1) };
}

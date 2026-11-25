/** "Nản" detection (DOMAIN §4.2) — computed by the server, never by the model. */

export type ChildEvent =
  | { kind: "text"; text: string }
  | { kind: "button"; label: string; replyTo?: string };

const MATH_MARK = /[0-9=+\-−×*:/^√<>≤≥]/;
const TERSE_WORDS = new Set([
  "k", "ko", "khong", "kb", "ko bt", "ko biet", "k biet", "khong biet", "em khong biet", "thoi", "chan", "met", "bo",
]);
export const NOT_UNDERSTOOD = "Chưa hiểu";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** A "dead-end" message: ≤ 3 characters without digits or math signs, or a listed give-up word. */
export function isTerse(text: string): boolean {
  const t = text.trim();
  if (t.length <= 3 && !MATH_MARK.test(t)) return true;
  return TERSE_WORDS.has(normalize(t));
}

const NO_IDEA = /\b(chua|khong|ko|k|hong|chang) (biet|hieu)\b|\bkb\b|\bko bt\b/;

/**
 * D36: the child says it does not know or does not understand (or sends a dead-end message). Used when no answer got
 * through the checker: the turn still counts as "khong_biet" for the hint level, so a stuck child is not left at H0.
 */
export function saysNoIdea(text: string): boolean {
  return isTerse(text) || NO_IDEA.test(normalize(text));
}

/**
 * True when the newest events show nản:
 * - the last two events are both typed AND both terse (a button press breaks the run), or
 * - "Chưa hiểu" was pressed 3 times for the same tutor message (`replyTo` = root message id).
 */
export function isNanSignal(events: readonly ChildEvent[]): boolean {
  const last = events.at(-1);
  const prev = events.at(-2);
  if (last?.kind === "text" && prev?.kind === "text" && isTerse(last.text) && isTerse(prev.text)) {
    return true;
  }
  if (last?.kind === "button" && last.label === NOT_UNDERSTOOD && last.replyTo) {
    const sameRoot = events.filter(
      (e) => e.kind === "button" && e.label === NOT_UNDERSTOOD && e.replyTo === last.replyTo,
    ).length;
    if (sameRoot >= 3) return true;
  }
  return false;
}

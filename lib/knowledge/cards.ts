// lib/knowledge/cards.ts — the approved teaching cards at run time (G6, design C).
import data from "@/knowledge/cards.json";
import { numbersIn } from "@/lib/tools/makeSibling";
import { CARD_REF, CardBundle, type Card } from "./cardSchema";

const BUNDLE = CardBundle.parse(data);
const BY_CODE = new Map(BUNDLE.cards.map((c) => [c.code, c]));

export const cardsVersion = BUNDLE.version;
export const card = (code: string): Card | null => BY_CODE.get(code) ?? null;
export const allCards = (): readonly Card[] => BUNDLE.cards;

/** "T6.12#1" → card + way, or null when the reference or the card is unknown. */
export function cardFromRef(ref: string | null | undefined): { card: Card; n: 1 | 2 } | null {
  const m = ref ? CARD_REF.exec(ref) : null;
  const c = m ? card(m[1]!) : null;
  return c ? { card: c, n: Number(m![2]) as 1 | 2 } : null;
}

/**
 * D36: the approved "ban_chat" card of a lesson, for a turn where no answer got through the checker — shown in place
 * of a pre-written safe line. Never a reading card (doc_de), never the other grade, never a card already shown here.
 */
export function lessonCard(ku: string | null, grade: 6 | 9, shownCodes: readonly string[]): Card | null {
  if (!ku) return null;
  return BUNDLE.cards.find((c) => c.kind === "ban_chat" && c.ku === ku && c.grade === grade && !shownCodes.includes(c.code)) ?? null;
}

/** A card can be shown to a child of `grade` (a grade-6 child never gets T9/N8 cards, and the reverse). */
export const cardFitsGrade = (c: Card, grade: 6 | 9): boolean => c.grade === grade;

/** Mục lục for the prompt (end of layer ③): one line per card of the grade. Stable order → stable cache. */
export function cardIndexText(grade: 6 | 9): string {
  const own = BUNDLE.cards.filter((c) => c.grade === grade);
  if (!own.length) return "[MỤC LỤC THẺ — chưa có thẻ nào]";
  const tag = { ban_chat: "", doc_de: " (đọc đề)", cach_lam: " (cách làm — bài mẫu)" } as const;
  const line = (c: Card) => `${c.code} · ${c.title}${tag[c.kind]}`;
  return ["[MỤC LỤC THẺ — chỉ dùng đúng các mã này cho the_hien]", ...own.map(line)].join("\n");
}

/**
 * C1: the example of the card must not use the child's numbers. A way clashes when at least two of its
 * key numbers (or its only key number) appear in the child's problem as whole numbers.
 */
export function clashes(keyNumbers: readonly string[], problemText: string): boolean {
  if (!keyNumbers.length) return false;
  const inProblem = new Set(numbersIn(problemText));
  const shared = keyNumbers.filter((n) => inProblem.has(n)).length;
  return keyNumbers.length === 1 ? shared === 1 : shared >= 2;
}

/** Point names in a problem (ABC, BE, AE in "AE·AC"): runs of ≥ 2 capital Latin letters standing alone. */
export function labelsIn(text: string): string[] {
  return [...new Set(text.match(/(?<!\p{L})[A-Z]{2,}(?!\p{L})/gu) ?? [])];
}

const sameFigure = (label: string) => [...label].sort().join("");

/**
 * G6d: geometry cards have almost no numbers, so their example is kept away from the child's figure by
 * the point names instead (PQR = RQP, PK = KP). Same rule as numbers: two shared names, or the only one.
 */
export function labelClashes(keyLabels: readonly string[], problemText: string): boolean {
  if (!keyLabels.length) return false;
  const inProblem = new Set(labelsIn(problemText).map(sameFigure));
  const shared = keyLabels.filter((l) => inProblem.has(sameFigure(l))).length;
  return keyLabels.length === 1 ? shared === 1 : shared >= 2;
}

/** A way clashes when its numbers or its point names are the child's problem's. */
export function wayClashes(v: { keyNumbers: readonly string[]; keyLabels?: readonly string[] }, problemText: string): boolean {
  return clashes(v.keyNumbers, problemText) || labelClashes(v.keyLabels ?? [], problemText);
}

/** The way to show: `wanted` unless it clashes, else the other way; null when both clash. */
export function pickVariant(c: Card, wanted: 1 | 2, problemText: string): 1 | 2 | null {
  const order: (1 | 2)[] = wanted === 1 ? [1, 2] : [2, 1];
  return order.find((n) => !wayClashes(c.variants[n - 1]!, problemText)) ?? null;
}

/** What the tutor reads back in the history under a message that showed a card (it never sees the screen). */
export function cardForModel(ref: string | null | undefined): string | null {
  const hit = cardFromRef(ref);
  if (!hit) return null;
  const v = hit.card.variants[hit.n - 1]!;
  return `[THẺ ĐÃ HIỆN CHO EM: ${hit.card.code}#${hit.n} — ${hit.card.title} — ${v.title}]\n${v.body}`;
}

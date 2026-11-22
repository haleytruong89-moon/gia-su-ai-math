// lib/tutor/scripted.ts — button turns the server answers without the model (G6, Y3: no model call, no turn counted).
import { card, wayClashes } from "@/lib/knowledge/cards";
import {
  BTN_CARD_AGAIN, BTN_NOT_UNDERSTAND_PROBLEM, BTN_SAVE, BTN_TRY_AGAIN, CARD_AGAIN_INTRO, CARD_BUTTONS, CARDS_DONE,
  DOC_DE_ASK, DOC_DE_BUTTONS,
} from "@/lib/copy";

export type Scripted =
  | { kind: "doc_de_ask"; message: string; buttons: string[] }
  | { kind: "card"; message: string; cardRef: string; buttons: string[] }
  /** `gap` names the card whose two ways were not enough (C5); the report reads it back from the thread. */
  | { kind: "cards_done"; message: string; buttons: string[]; gap: string };

export interface ScriptedInput {
  text: string;
  kind: "text" | "button" | "submit";
  grade: 6 | 9;
  /** the last card the child saw in this problem */
  lastCard: { code: string; n: 1 | 2 } | null;
  /** the problem as known (confirmed restatement, else typed text): the other way must not use its numbers (C1) */
  problemText: string;
}

/** null = a normal model turn. Only a pressed button is ever scripted (typed text always reaches the tutor). */
export function scriptedTurn(a: ScriptedInput): Scripted | null {
  if (a.kind !== "button") return null;
  if (a.text === BTN_NOT_UNDERSTAND_PROBLEM) {
    return { kind: "doc_de_ask", message: DOC_DE_ASK, buttons: [...DOC_DE_BUTTONS.slice(0, a.grade === 6 ? 3 : 4)] };
  }
  if (a.text === BTN_CARD_AGAIN && a.lastCard) {
    const c = card(a.lastCard.code);
    if (!c) return null;
    // Way 2 is shown either after way 1 or because way 1 used the child's numbers: no third way (C2).
    if (a.lastCard.n === 1 && !wayClashes(c.variants[1]!, a.problemText)) {
      return { kind: "card", message: CARD_AGAIN_INTRO, cardRef: `${c.code}#2`, buttons: [...CARD_BUTTONS] };
    }
    return { kind: "cards_done", message: CARDS_DONE, buttons: [BTN_SAVE, BTN_TRY_AGAIN], gap: `het_cach:${c.code}` };
  }
  return null;
}

/** The last card shown in a thread (newest tutor message with a card), for "Giảng lại cách khác". */
export function lastCardOf(thread: readonly { role: "child" | "tutor"; cardRef?: string | null }[]): { code: string; n: 1 | 2 } | null {
  const ref = [...thread].reverse().find((m) => m.role === "tutor" && m.cardRef)?.cardRef;
  const m = ref ? /^(.+)#([12])$/.exec(ref) : null;
  return m ? { code: m[1]!, n: Number(m[2]) as 1 | 2 } : null;
}

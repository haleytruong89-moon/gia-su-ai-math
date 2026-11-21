// lib/knowledge/cardText.ts — the text of a shown card for the screens (client-safe: no zod, no server code).
// The bundle is validated at build (`npm run cards:check`) and on the server (lib/knowledge/cards.ts).
import data from "@/knowledge/cards.json";
import type { CardBundle } from "./cardSchema";

const CARDS = (data as CardBundle).cards;

export interface CardText { code: string; n: 1 | 2; title: string; wayTitle: string; body: string }

/** "T6.12#1" → what the child sees; null when the bundle no longer has it (an older thread). */
export function cardText(ref: string | null | undefined): CardText | null {
  const m = ref ? /^((?:T6|T9|N7|N8|TH|D6|D9)\.[0-9]{1,2})#([12])$/.exec(ref) : null;
  const c = m ? CARDS.find((x) => x.code === m[1]) : undefined;
  if (!m || !c) return null;
  const n = Number(m[2]) as 1 | 2;
  const v = c.variants[n - 1]!;
  return { code: c.code, n, title: c.title, wayTitle: v.title, body: v.body };
}

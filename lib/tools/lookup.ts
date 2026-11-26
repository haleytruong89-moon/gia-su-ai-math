// lib/tools/lookup.ts — the tutor's lookup tool (C4): a knowledge unit or a toolbox section by code (G5).
import { lookupText } from "@/lib/knowledge/card";
import { card } from "@/lib/knowledge/cards";

export function runLookup(input: unknown): { ok: boolean; output: { text: string } | { error: "not_found" | "bad_input" } } {
  const code = (input as { code?: unknown } | null)?.code;
  if (typeof code !== "string" || !code.trim()) return { ok: false, output: { error: "bad_input" } };
  // D38 (eval 26/11): the tutor looked a card code up, got not_found and wrote its own example instead of the card.
  // Only reading (D…) and method (C…) codes: a T… code is also a lesson, which lookup describes.
  const c = /^[CD](6|9)\./.test(code.trim()) ? card(code.trim()) : null;
  if (c) return { ok: true, output: { text: `${c.code} là thẻ đã duyệt "${c.title}". Không cần tra: điền the_hien = "${c.code}", app hiện nguyên văn thẻ.` } };
  const text = lookupText(code.trim());
  return text ? { ok: true, output: { text } } : { ok: false, output: { error: "not_found" } };
}

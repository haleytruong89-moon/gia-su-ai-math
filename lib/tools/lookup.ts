// lib/tools/lookup.ts — the tutor's lookup tool (C4): a knowledge unit or a toolbox section by code (G5).
import { lookupText } from "@/lib/knowledge/card";

export function runLookup(input: unknown): { ok: boolean; output: { text: string } | { error: "not_found" | "bad_input" } } {
  const code = (input as { code?: unknown } | null)?.code;
  if (typeof code !== "string" || !code.trim()) return { ok: false, output: { error: "bad_input" } };
  const text = lookupText(code.trim());
  return text ? { ok: true, output: { text } } : { ok: false, output: { error: "not_found" } };
}

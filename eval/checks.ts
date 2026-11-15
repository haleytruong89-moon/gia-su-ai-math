// eval/checks.ts — automatic checks of one tutor turn (BO_TEST §3). Pure, tested in tests/evalChecks.test.ts.
import type { TutorOutput } from "@/lib/tutor/schema";

export interface Expect {
  flags?: TutorOutput["flags"];
  notSelfSolved?: boolean;
  ketQua?: TutorOutput["ket_qua_bai"][];
  verdictIn?: TutorOutput["danh_gia_luot_em"][];
  minButtons?: number;
  buttonMatches?: RegExp;
  statementConfirmed?: boolean;
}
export interface CheckSpec { maxLines: number; forbid?: string[]; expect?: Expect }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when `needle` appears in `text`: a number only as a whole number; other text with any spacing. */
export function mentions(text: string, needle: string): boolean {
  const t = text.toLowerCase();
  if (/^\d+$/.test(needle)) return new RegExp(`(?<![\\d,.])${needle}(?![\\d]|[,.]\\d)`).test(t);
  const loose = needle.toLowerCase().split(/\s+/).filter(Boolean).map(escape).join("\\s*");
  return new RegExp(loose).test(t);
}

export const messageLines = (m: string) => m.split("\n").filter((l) => l.trim().length > 0).length;

export function checkOutput(o: TutorOutput | null, spec: CheckSpec): { failures: string[]; leak: boolean } {
  if (!o) return { failures: ["format"], leak: false };
  const f: string[] = [];
  const leaks = (spec.forbid ?? []).filter((n) => mentions(o.message, n));
  for (const n of leaks) f.push(`leak:${n}`);
  const lines = messageLines(o.message);
  if (lines > spec.maxLines) f.push(`lines:${lines}>${spec.maxLines}`);
  const e = spec.expect ?? {};
  for (const fl of e.flags ?? []) if (!o.flags.includes(fl)) f.push(`flag_missing:${fl}`);
  if (e.notSelfSolved && o.ket_qua_bai === "self_solved") f.push("self_solved_too_early");
  if (e.ketQua && !e.ketQua.includes(o.ket_qua_bai)) f.push(`ket_qua:${o.ket_qua_bai}`);
  if (e.minButtons !== undefined && o.buttons.length < e.minButtons) f.push(`buttons:${o.buttons.length}<${e.minButtons}`);
  if (e.verdictIn && !e.verdictIn.includes(o.danh_gia_luot_em)) f.push(`verdict:${o.danh_gia_luot_em}`);
  if (e.buttonMatches && !o.buttons.some((b) => e.buttonMatches!.test(b))) f.push(`button_missing:${e.buttonMatches}`);
  if (e.statementConfirmed !== undefined && o.de_da_xac_nhan !== e.statementConfirmed) f.push(`de_da_xac_nhan:${o.de_da_xac_nhan}`);
  return { failures: f, leak: leaks.length > 0 };
}

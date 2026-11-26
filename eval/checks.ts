// eval/checks.ts — automatic checks of one tutor turn (BO_TEST §3). Pure, tested in tests/evalChecks.test.ts.
import { messageLines } from "@/lib/tutor/lines";
import type { TutorOutput } from "@/lib/tutor/schema";

export { messageLines };

export interface Expect {
  flags?: TutorOutput["flags"];
  notSelfSolved?: boolean;
  ketQua?: TutorOutput["ket_qua_bai"][];
  verdictIn?: TutorOutput["danh_gia_luot_em"][];
  minButtons?: number;
  buttonMatches?: RegExp;
  statementConfirmed?: boolean;
  /** G4: tools the answer must have used, as keys of toolKeys() — e.g. "math_check", "make_sibling:verified" */
  toolsInclude?: string[];
  /** G5: the teaching technique must be one of these; the background gap must be this code. */
  kyThuat?: TutorOutput["ky_thuat"][];
  prereqGap?: string;
  /** G6: the approved card the tutor must name (`the_hien`), or null for "no card". */
  theHien?: string | null;
  /** D38: the answer brings a list of jobs the app would show (the card's, or the tutor's when it gives nothing away). */
  keHoach?: boolean;
  /** D38: after a wrong final answer the tutor names the job(s) to redo. */
  viecCanLamLai?: boolean;
}
/** `plan`: the list the app would show under the message (D38), also checked for leaks. */
export interface CheckSpec { maxLines: number; forbid?: string[]; expect?: Expect; tools?: string[]; plan?: string[] | null }

/** Keys of one tool call: "math_check", "math_check:<mode>"; "make_sibling", "make_sibling:verified" (usable). */
export function toolKeys(t: { tool: string; input: unknown; output: unknown }): string[] {
  if (t.tool === "math_check") {
    const mode = (t.input as { mode?: string } | null)?.mode;
    return ["math_check", ...(mode ? [`math_check:${mode}`] : [])];
  }
  if (t.tool === "lookup") {
    const code = (t.input as { code?: string } | null)?.code;
    return ["lookup", ...(code ? [`lookup:${code}`] : [])];
  }
  const o = t.output as { verified?: boolean; numbers_differ?: boolean } | null;
  return [t.tool, ...(t.tool === "make_sibling" && o?.verified && o.numbers_differ ? ["make_sibling:verified"] : [])];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when `needle` appears in `text`: a number only as a whole number; other text with any spacing. */
export function mentions(text: string, needle: string): boolean {
  const t = text.toLowerCase();
  if (/^\d+$/.test(needle)) return new RegExp(`(?<![\\d,.])${needle}(?![\\d]|[,.]\\d)`).test(t);
  const loose = needle.toLowerCase().split(/\s+/).filter(Boolean).map(escape).join("\\s*");
  return new RegExp(loose).test(t);
}


export function checkOutput(o: TutorOutput | null, spec: CheckSpec): { failures: string[]; leak: boolean } {
  if (!o) return { failures: ["format"], leak: false };
  const f: string[] = [];
  // The answer must not show up in the buttons either (prompt v0.3 rule 1; G0 run 3, case 6.3).
  const shown = [o.message, ...o.buttons, ...(spec.plan ?? [])].join("\n");
  const leaks = (spec.forbid ?? []).filter((n) => mentions(shown, n));
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
  for (const k of e.toolsInclude ?? []) if (!(spec.tools ?? []).includes(k)) f.push(`tool_missing:${k}`);
  if (e.kyThuat && !e.kyThuat.includes(o.ky_thuat)) f.push(`ky_thuat:${o.ky_thuat}`);
  if (e.prereqGap !== undefined && o.prereq_gap !== e.prereqGap) f.push(`prereq_gap:${o.prereq_gap ?? "null"}`);
  if (e.theHien !== undefined && (o.the_hien ?? null) !== e.theHien) f.push(`the_hien:${o.the_hien ?? "null"}`);
  if (e.keHoach && !spec.plan?.length) f.push("ke_hoach_missing");
  if (e.viecCanLamLai && !o.viec_can_lam_lai?.length) f.push("viec_can_lam_lai_missing");
  return { failures: f, leak: leaks.length > 0 };
}

// lib/tools/mathCheck.ts — the math_check tool: the model's input → the cas arguments of each mode.
import type { CasClient, CasResult } from "@/lib/tools/casClient";
import { MATH_MODES, type MathMode } from "@/lib/tools/defs";

type Input = Record<string, unknown>;
const s = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const list = (v: unknown): string[] | undefined =>
  Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string") ? (v as string[]) : undefined;
const dict = (v: unknown): Record<string, string> | undefined =>
  v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every((x) => typeof x === "string") && Object.keys(v).length > 0
    ? (v as Record<string, string>) : undefined;

/** The cas arguments for one call, or null when a field the mode needs is missing. */
export function toCasArgs(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const i = raw as Input;
  const mode = i.mode as MathMode;
  if (!MATH_MODES.includes(mode)) return null;
  const variable = s(i.variable) ?? "x";
  const assumptions = list(i.assumptions) ?? [];
  const need = <T extends Record<string, unknown>>(o: T): T | null => (Object.values(o).some((v) => v === undefined) ? null : o);
  switch (mode) {
    case "equivalent": return need({ expr_a: s(i.expr_a), expr_b: s(i.expr_b), variable, assumptions });
    case "simplify_check": return need({ expr_child: s(i.expr_a), expr_original: s(i.expr_b), variable, assumptions });
    case "solve": return need({ equation: s(i.equation), variable, assumptions });
    case "check_root": return need({ equation: s(i.equation), value: s(i.value), variable });
    case "evaluate": {
      const out = need({ expr: s(i.expr_a), variable });
      if (!out) return null;
      return { ...out, ...(s(i.value) ? { value: s(i.value) } : {}), ...(Number.isInteger(i.round_to) ? { round_to: i.round_to } : {}) };
    }
    case "inequality": return need({ inequality_text: s(i.inequality), variable });
    case "domain": return need({ expr: s(i.expr_a), variable });
    case "solve_system": return need({ equations: list(i.equations), variables: list(i.variables) });
    case "check_solution": return need({ equations: list(i.equations), values: dict(i.values) });
  }
}

/** Runs one math_check for the tutor. Never throws: errors come back as { ok: false, error }. */
export async function runMathCheck(cas: CasClient | null, input: unknown): Promise<{ ok: boolean; output: CasResult }> {
  if (!cas) return { ok: false, output: { ok: false, error: "cas_not_configured" } };
  const args = toCasArgs(input);
  if (!args) return { ok: false, output: { ok: false, error: "missing_field" } };
  const output = await cas.check((input as Input).mode as string, args);
  return { ok: output.ok, output };
}

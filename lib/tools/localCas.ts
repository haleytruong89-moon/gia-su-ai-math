// lib/tools/localCas.ts — an exact NUMBER checker inside the app (D36, 25/11/2026).
// In real use the algebra service (cas/, SymPy on Vercel Services) was not configured on the deployment: every
// math_check came back "cas_not_configured", so the tutor could never say a child's ƯCLN was right, no sibling
// problem could be verified, and no computed problem could close. Grade 6 number work (ƯCLN, BCNN, fractions)
// and substituting numbers into an equation or a system only need exact arithmetic, done here with BigInt
// fractions. Anything else (letters left over, roots, simplifying, solving) is NOT guessed: it returns the same
// "cas_not_configured" error as before, and the tutor treats it as "the machine could not check".
import type { CasClient, CasResult } from "@/lib/tools/casClient";

export interface Frac { n: bigint; d: bigint }

const abs = (x: bigint) => (x < 0n ? -x : x);
const gcdInt = (a: bigint, b: bigint): bigint => {
  a = abs(a); b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
function frac(n: bigint, d: bigint): Frac | null {
  if (d === 0n) return null;
  if (d < 0n) { n = -n; d = -d; }
  const g = gcdInt(n, d) || 1n;
  return { n: n / g, d: d / g };
}
const add = (a: Frac, b: Frac) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d);
const div = (a: Frac, b: Frac) => (b.n === 0n ? null : frac(a.n * b.d, a.d * b.n));
function pow(a: Frac, e: Frac): Frac | null {
  if (e.d !== 1n || abs(e.n) > 64n) return null; // only whole exponents, kept small
  let r: Frac | null = { n: 1n, d: 1n };
  for (let i = 0n; i < abs(e.n); i++) r = r && mul(r, a);
  return r && (e.n < 0n ? div({ n: 1n, d: 1n }, r) : r);
}
export const fracText = (f: Frac): string => (f.d === 1n ? f.n.toString() : `${f.n}/${f.d}`);

type Tok = { t: "num"; v: Frac } | { t: "id"; v: string } | { t: "op"; v: string };
const FUNCS: Record<string, string> = { gcd: "gcd", lcm: "lcm", ucln: "gcd", bcnn: "lcm", ƯCLN: "gcd", BCNN: "lcm" };

/** Tokens of an expression, or null on a character it does not know. A comma inside gcd(…) separates arguments. */
function tokenize(src: string): Tok[] | null {
  const s = src.replace(/\*\*/g, "^").replace(/[×·]/g, "*").replace(/[÷:]/g, "/").replace(/[−–]/g, "-").replace(/;/g, ",");
  const out: Tok[] = [];
  const parens: ("fn" | "group")[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9]/.test(s[j]!)) j++;
      let digits = s.slice(i, j);
      let scale = 0;
      const sep = s[j];
      const decimal = sep === "." || (sep === "," && parens.at(-1) !== "fn");
      if (decimal && /[0-9]/.test(s[j + 1] ?? "")) {
        let k = j + 1;
        while (k < s.length && /[0-9]/.test(s[k]!)) k++;
        digits += s.slice(j + 1, k);
        scale = k - j - 1;
        j = k;
      }
      out.push({ t: "num", v: frac(BigInt(digits), 10n ** BigInt(scale))! });
      i = j;
      continue;
    }
    if (/[A-Za-zƯư]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-zƯưĐđ_0-9]/.test(s[j]!) && !(j > i && /[0-9]/.test(s[j]!) && !FUNCS[s.slice(i, j)])) j++;
      const word = s.slice(i, j);
      const fn = FUNCS[word] ?? FUNCS[word.toLowerCase()];
      if (fn) { out.push({ t: "id", v: `fn:${fn}` }); i = j; continue; }
      // letters that are not a known function are single-letter variables: "2xy" = 2·x·y
      for (const ch of word) out.push({ t: "id", v: ch });
      i = j;
      continue;
    }
    if (c === "(") {
      const prev = out.at(-1);
      parens.push(prev?.t === "id" && prev.v.startsWith("fn:") ? "fn" : "group");
      out.push({ t: "op", v: c });
      i++;
      continue;
    }
    if (c === ")") { parens.pop(); out.push({ t: "op", v: c }); i++; continue; }
    if ("+-*/^,".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    return null; // √, =, letters of other alphabets, …
  }
  return out;
}

/** The exact value of `expr` with the letters in `vars` replaced by numbers; null when it cannot be done exactly. */
export function evalExact(expr: string, vars: Record<string, string> = {}): Frac | null {
  const tokens = tokenize(expr);
  if (!tokens || !tokens.length) return null;
  const toks: Tok[] = tokens;
  const values = new Map<string, Frac>();
  for (const [k, raw] of Object.entries(vars)) {
    const val = evalExact(raw);
    if (!val) return null;
    values.set(k, val);
  }
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;
  const startsAtom = () => { const k = peek(); return !!k && (k.t !== "op" || k.v === "("); };

  function expression(): Frac | null {
    let a = term();
    while (a && (isOp("+") || isOp("-"))) {
      const op = (toks[p++] as { v: string }).v;
      const b = term();
      a = b && (op === "+" ? add(a, b) : sub(a, b));
    }
    return a;
  }
  function term(): Frac | null {
    let a = unary();
    while (a) {
      if (isOp("*") || isOp("/")) {
        const op = (toks[p++] as { v: string }).v;
        const b = unary();
        a = b && (op === "*" ? mul(a, b) : div(a, b));
      } else if (startsAtom()) {
        const b = unary(); // implicit multiplication: 2x, 3(x + 1), (a)(b)
        a = b && mul(a, b);
      } else break;
    }
    return a;
  }
  function unary(): Frac | null {
    if (isOp("-")) { p++; const a = unary(); return a && frac(-a.n, a.d); }
    if (isOp("+")) { p++; return unary(); }
    return power();
  }
  function power(): Frac | null {
    const a = atom();
    if (a && isOp("^")) { p++; const e = unary(); return e && pow(a, e); }
    return a;
  }
  function atom(): Frac | null {
    const k = toks[p++];
    if (!k) return null;
    if (k.t === "num") return k.v;
    if (k.t === "id" && k.v.startsWith("fn:")) {
      if (!isOp("(")) return null;
      p++;
      const args: Frac[] = [];
      for (;;) {
        const a = expression();
        if (!a || a.d !== 1n) return null; // ƯCLN / BCNN of whole numbers only
        args.push(a);
        if (isOp(",")) { p++; continue; }
        if (isOp(")")) { p++; break; }
        return null;
      }
      if (args.length < 2) return null;
      const ns = args.map((a) => abs(a.n));
      const r = k.v === "fn:gcd" ? ns.reduce(gcdInt) : ns.reduce((x, y) => (x === 0n || y === 0n ? 0n : (x / gcdInt(x, y)) * y));
      return { n: r, d: 1n };
    }
    if (k.t === "id") return values.get(k.v) ?? null; // a letter without a value: not a number job
    if (k.v === "(") {
      const a = expression();
      if (!a || !isOp(")")) return null;
      p++;
      return a;
    }
    return null;
  }
  const r = expression();
  return r && p === toks.length ? r : null;
}

/** Both sides of "left = right" with numbers substituted: true / false, or null when it cannot be checked exactly. */
function holds(equation: string, vars: Record<string, string>): boolean | null {
  const sides = equation.split("=");
  if (sides.length !== 2) return null;
  const l = evalExact(sides[0]!, vars);
  const r = evalExact(sides[1]!, vars);
  return l && r ? l.n * r.d === r.n * l.d : null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** One check done with numbers only, in the cas result shapes (cas/app/mathcheck.py); null = not a number job. */
export function localCheck(mode: string, a: Record<string, unknown>): CasResult | null {
  const variable = str(a.variable) ?? "x";
  switch (mode) {
    case "evaluate": {
      if (a.round_to !== undefined) return null;
      const expr = str(a.expr);
      const value = str(a.value);
      const r = expr ? evalExact(expr, value ? { [variable]: value } : {}) : null;
      return r ? { ok: true, result: { exact: fracText(r) } } : null;
    }
    case "equivalent": {
      const x = str(a.expr_a) && evalExact(a.expr_a as string);
      const y = str(a.expr_b) && evalExact(a.expr_b as string);
      return x && y ? { ok: true, result: { equivalent: x.n * y.d === y.n * x.d, method: "exact_numbers" } } : null;
    }
    case "check_root": {
      const eq = str(a.equation);
      const value = str(a.value);
      const ok = eq && value ? holds(eq, { [variable]: value }) : null;
      return ok === null ? null : { ok: true, result: { is_root: ok, undefined: false } };
    }
    case "check_solution": {
      const eqs = Array.isArray(a.equations) ? (a.equations as unknown[]).filter((e): e is string => typeof e === "string") : [];
      const values = a.values && typeof a.values === "object" ? (a.values as Record<string, string>) : null;
      if (!eqs.length || !values) return null;
      const results = eqs.map((e) => holds(e, values));
      if (results.some((x) => x === null)) return null;
      const failed = eqs.filter((_, i) => results[i] === false);
      return { ok: true, result: { satisfies: failed.length === 0, failed } };
    }
    default:
      return null;
  }
}

/** The algebra service is down rather than giving an answer: worth trying the number checker. */
const isDown = (error: string) => error === "timeout" || error === "cas_unreachable" || /^cas_http_\d+$/.test(error);

/**
 * math_check's client: the algebra service when there is one (its answers always win), the number checker when it is
 * missing or down. `limited` = no algebra service at all: the tutor is told (⑥ `may_tinh: chi_so`).
 */
export function localCas(remote: CasClient | null): CasClient & { limited: boolean } {
  return {
    limited: remote === null,
    async check(mode, args) {
      if (remote) {
        const r = await remote.check(mode, args);
        if (r.ok || !isDown(r.error)) return r;
        return localCheck(mode, args) ?? r;
      }
      return localCheck(mode, args) ?? { ok: false, error: "cas_not_configured" };
    },
    health: () => (remote ? remote.health() : Promise.resolve(false)),
  };
}

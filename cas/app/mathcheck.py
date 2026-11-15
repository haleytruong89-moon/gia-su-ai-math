"""math_check (C1): the tutor's algebra checker. Pure functions, no network, no state.

Input expressions use SymPy syntax: sqrt(x), x**2, Rational via a/b. Variables are real.
`assumptions` is a short list like ["x >= 0", "x != 9"]. Every function returns a plain dict
that the Node server forwards to the model as the tool result.
"""
from __future__ import annotations

import random
from typing import Any

import sympy as sp
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

_TRANSFORMS = standard_transformations + (implicit_multiplication_application,)
_ALLOWED = {"sqrt": sp.sqrt, "cbrt": sp.cbrt, "Abs": sp.Abs, "pi": sp.pi, "gcd": sp.gcd, "lcm": sp.lcm}
MAX_LEN = 400


class MathInputError(ValueError):
    pass


def _parse(text: str, symbols: dict[str, sp.Symbol]) -> sp.Expr:
    if not isinstance(text, str) or not text.strip() or len(text) > MAX_LEN:
        raise MathInputError("expression empty or too long")
    if any(bad in text for bad in ("__", "import", "lambda", "eval", "exec", ";")):
        raise MathInputError("expression contains forbidden text")
    local = dict(_ALLOWED)
    local.update(symbols)
    try:
        return parse_expr(text.replace("^", "**").replace("√", "sqrt").replace("−", "-"),
                          local_dict=local, transformations=_TRANSFORMS, evaluate=True)
    except Exception as exc:  # noqa: BLE001 - any parse failure is a user input problem
        raise MathInputError(f"cannot parse: {text}") from exc


def _symbols(variable: str) -> dict[str, sp.Symbol]:
    if not isinstance(variable, str) or not variable.isidentifier() or variable.startswith("_") or len(variable) > 3:
        raise MathInputError("bad variable name")
    return {variable: sp.Symbol(variable, real=True)}


def _parse_assumption(text: str, symbols: dict[str, sp.Symbol]) -> sp.Basic:
    for op in (">=", "<=", "!=", ">", "<"):
        if op in text:
            left, right = text.split(op, 1)
            a, b = _parse(left, symbols), _parse(right, symbols)
            return {">=": sp.Ge, "<=": sp.Le, "!=": sp.Ne, ">": sp.Gt, "<": sp.Lt}[op](a, b)
    raise MathInputError(f"bad assumption: {text}")


def _sample_points(var: sp.Symbol, conds: list[sp.Basic], n: int = 12) -> list[sp.Rational]:
    rng = random.Random(7)
    points: list[sp.Rational] = []
    tries = 0
    while len(points) < n and tries < 400:
        tries += 1
        cand = sp.Rational(rng.randint(1, 400), rng.choice([1, 2, 3, 4, 5, 7]))
        if rng.random() < 0.3:
            cand = -cand
        if all(bool(c.subs(var, cand)) for c in conds):
            points.append(cand)
    return points


def _numeric_equal(a: sp.Expr, b: sp.Expr, var: sp.Symbol, conds: list[sp.Basic]) -> bool | None:
    pts = _sample_points(var, conds)
    if len(pts) < 5:
        return None
    checked = 0
    for p in pts:
        va, vb = a.subs(var, p), b.subs(var, p)
        if va.has(sp.zoo, sp.nan) or vb.has(sp.zoo, sp.nan):
            continue
        da, db = complex(sp.N(va, 30)), complex(sp.N(vb, 30))
        if abs(da.imag) > 1e-9 or abs(db.imag) > 1e-9:
            continue
        checked += 1
        if abs(da - db) > 1e-9 * max(1.0, abs(da)):
            return False
    return True if checked >= 5 else None


def equivalent(expr_a: str, expr_b: str, variable: str = "x", assumptions: list[str] | None = None) -> dict[str, Any]:
    syms = _symbols(variable)
    var = syms[variable]
    a, b = _parse(expr_a, syms), _parse(expr_b, syms)
    conds = [_parse_assumption(c, syms) for c in (assumptions or [])]
    symbolic = sp.simplify(a - b) == 0
    numeric = _numeric_equal(a, b, var, conds)
    return {"equivalent": bool(symbolic or numeric), "method": "symbolic" if symbolic else "numeric"}


def simplify_check(expr_child: str, expr_original: str, variable: str = "x",
                   assumptions: list[str] | None = None) -> dict[str, Any]:
    """Is the child's result equal to the original AND fully reduced (no common factor left)?"""
    eq = equivalent(expr_child, expr_original, variable, assumptions)
    syms = _symbols(variable)
    var = syms[variable]
    t = sp.Symbol("t", nonnegative=True)
    child = _parse(expr_child, syms).subs(sp.sqrt(var), t).subs(var, t**2)
    child = sp.together(child)
    num, den = sp.fraction(child)
    common = sp.S.One
    if num.is_polynomial(t) and den.is_polynomial(t):
        common = sp.gcd(sp.Poly(sp.expand(num), t), sp.Poly(sp.expand(den), t)).as_expr()
    fully = sp.degree(common, t) <= 0 if common.has(t) else True
    hint = None
    if not fully:
        hint = str(sp.factor(common).subs(t, sp.sqrt(var)))
    return {"equivalent": eq["equivalent"], "fully_simplified": bool(fully), "common_factor": hint}


def solve(equation: str, variable: str = "x", assumptions: list[str] | None = None) -> dict[str, Any]:
    """`equation` is 'left = right' (or an expression meaning '= 0'). Domain exclusions are applied."""
    syms = _symbols(variable)
    var = syms[variable]
    left, _, right = equation.partition("=")
    lhs = _parse(left, syms)
    rhs = _parse(right, syms) if right.strip() else sp.S.Zero
    conds = [_parse_assumption(c, syms) for c in (assumptions or [])]
    raw = sp.solveset(sp.Eq(lhs, rhs), var, domain=sp.S.Reals)
    excluded: list[str] = []
    kept: list[sp.Expr] = []
    if isinstance(raw, sp.FiniteSet):
        for s in raw:
            bad_den = any(sp.simplify(d.subs(var, s)) == 0 for d in _denominators(lhs - rhs))
            if bad_den or not all(bool(c.subs(var, s)) for c in conds):
                excluded.append(str(s))
            else:
                kept.append(s)
        return {"solutions": [str(s) for s in kept], "excluded": excluded, "no_real_solution": not kept}
    return {"solutions": None, "set": str(raw), "excluded": excluded, "no_real_solution": raw == sp.S.EmptySet}


def _denominators(expr: sp.Expr) -> list[sp.Expr]:
    dens = []
    for term in sp.preorder_traversal(expr):
        if isinstance(term, sp.Pow) and term.exp.is_negative:
            dens.append(term.base)
    return dens


def check_root(equation: str, value: str, variable: str = "x") -> dict[str, Any]:
    syms = _symbols(variable)
    var = syms[variable]
    left, _, right = equation.partition("=")
    lhs = _parse(left, syms)
    rhs = _parse(right, syms) if right.strip() else sp.S.Zero
    v = _parse(value, syms)
    diff = sp.simplify((lhs - rhs).subs(var, v))
    return {"is_root": diff == 0, "undefined": diff.has(sp.zoo, sp.nan)}


def evaluate(expr: str, variable: str = "x", value: str | None = None, round_to: int | None = None) -> dict[str, Any]:
    syms = _symbols(variable)
    e = _parse(expr, syms)
    if value is not None:
        e = e.subs(syms[variable], _parse(value, syms))
    exact = sp.nsimplify(sp.radsimp(sp.simplify(e)))
    out: dict[str, Any] = {"exact": str(exact)}
    if round_to is not None:
        out["rounded"] = str(round(float(sp.N(exact, 30)), round_to))
    return out


def inequality(inequality_text: str, variable: str = "x") -> dict[str, Any]:
    syms = _symbols(variable)
    rel = _parse_assumption(inequality_text, syms)
    sol = sp.solve_univariate_inequality(rel, syms[variable], relational=False)
    return {"solution_set": str(sol)}


def domain(expr: str, variable: str = "x") -> dict[str, Any]:
    syms = _symbols(variable)
    from sympy.calculus.util import continuous_domain
    d = continuous_domain(_parse(expr, syms), syms[variable], sp.S.Reals)
    return {"domain": str(d)}


MAX_UNKNOWNS = 3


def _symbols_many(names: list[str]) -> dict[str, sp.Symbol]:
    if not isinstance(names, list) or not names or len(names) > MAX_UNKNOWNS:
        raise MathInputError("1 to 3 variables")
    out: dict[str, sp.Symbol] = {}
    for n in names:
        out.update(_symbols(n))
    return out


def _equation(text: str, syms: dict[str, sp.Symbol]) -> tuple[sp.Expr, sp.Expr]:
    left, _, right = text.partition("=")
    return _parse(left, syms), (_parse(right, syms) if right.strip() else sp.S.Zero)


def _equations(texts: list[str], syms: dict[str, sp.Symbol]) -> list[tuple[sp.Expr, sp.Expr]]:
    if not isinstance(texts, list) or not texts or len(texts) > MAX_UNKNOWNS:
        raise MathInputError("1 to 3 equations")
    return [_equation(t, syms) for t in texts]


def solve_system(equations: list[str], variables: list[str]) -> dict[str, Any]:
    """Real solutions of a system with up to 3 unknowns (word problems of grade 9: 'lập hệ phương trình')."""
    syms = _symbols_many(variables)
    eqs = _equations(equations, syms)
    order = [syms[v] for v in variables]
    raw = sp.solve([sp.Eq(lhs, rhs) for lhs, rhs in eqs], order, dict=True)
    kept: list[dict[str, str]] = []
    for sol in raw:
        if len(sol) != len(order) or any(not sp.sympify(v).is_real for v in sol.values()):
            continue
        undefined = any(_has_zero_denominator(lhs - rhs, sol) for lhs, rhs in eqs)
        if not undefined:
            kept.append({str(k): str(sp.nsimplify(v)) for k, v in sol.items()})
    return {"solutions": kept, "no_solution": not kept}


def _has_zero_denominator(expr: sp.Expr, values: dict) -> bool:
    return any(sp.simplify(d.subs(values)) == 0 for d in _denominators(expr))


def check_solution(equations: list[str], values: dict[str, str]) -> dict[str, Any]:
    """Does this point satisfy every equation? `failed` lists the indices of the equations it breaks."""
    if not isinstance(values, dict) or not values:
        raise MathInputError("values needed")
    syms = _symbols_many(list(values.keys()))
    point = {syms[k]: _parse(v, syms) for k, v in values.items()}
    failed: list[int] = []
    for i, (lhs, rhs) in enumerate(_equations(equations, syms)):
        diff = (lhs - rhs).subs(point)
        if _has_zero_denominator(lhs - rhs, point) or diff.has(sp.zoo, sp.nan) or sp.simplify(diff) != 0:
            failed.append(i)
    return {"satisfies": not failed, "failed": failed}


MODES = {
    "equivalent": equivalent,
    "simplify_check": simplify_check,
    "solve": solve,
    "check_root": check_root,
    "evaluate": evaluate,
    "inequality": inequality,
    "domain": domain,
    "solve_system": solve_system,
    "check_solution": check_solution,
}

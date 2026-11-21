"""Every "kiểm:" line of every approved teaching card must be True (G6, design C).

Runs in the CI `cas` job, next to the algebra service tests. One SymPy expression per line,
written with the names below (x, t ≥ 0; y > 0), e.g. `ilcm(12, 18) == 36` or
`simplify(1/(sqrt(x) - 4) - 8/(x - 16) - 1/(sqrt(x) + 4)) == 0`.
"""
import pathlib
import re

import pytest
from sympy import Eq, Rational, Symbol, factorint, gcd, ilcm, lcm, nsimplify, simplify, solve, sqrt
from sympy.parsing.sympy_parser import parse_expr

CARDS = sorted((pathlib.Path(__file__).resolve().parents[2] / "knowledge" / "src" / "cards").glob("*.md"))
NAMES = {
    "x": Symbol("x", nonnegative=True), "t": Symbol("t", nonnegative=True), "y": Symbol("y", positive=True),
    "gcd": gcd, "ilcm": ilcm, "lcm": lcm, "simplify": simplify, "solve": solve, "sqrt": sqrt,
    "factorint": factorint, "Rational": Rational, "Eq": Eq, "nsimplify": nsimplify,
}
LINES = [(p.name, m.group(1)) for p in CARDS for m in re.finditer(r"^kiểm: (.+)$", p.read_text("utf8"), re.M)]


def test_there_are_cards_and_checks():
    assert CARDS, "no cards in knowledge/src/cards"
    assert LINES, "no kiểm: lines"


def test_every_card_has_checks_in_both_ways():
    for p in CARDS:
        parts = re.split(r"^## ", p.read_text("utf8"), flags=re.M)
        ways = [s for s in parts if s.startswith("Cách ")]
        assert len(ways) == 2, f"{p.name}: needs 2 ways"
        for w in ways:
            assert re.search(r"^kiểm: ", w, re.M), f"{p.name}: a way without kiểm: lines"


@pytest.mark.parametrize("name,expr", LINES)
def test_check_line_is_true(name, expr):
    result = parse_expr(expr, local_dict=dict(NAMES))
    assert result == True, f"{name}: {expr} → {result}"  # noqa: E712 (SymPy booleans are not Python bools)


def test_a_wrong_line_is_caught():
    assert not (parse_expr("ilcm(12, 18) == 72", local_dict=dict(NAMES)) == True)  # noqa: E712

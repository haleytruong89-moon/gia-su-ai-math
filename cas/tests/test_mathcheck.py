"""Cases from BO_TEST_v0.2 §4 and HOP_CONG_CU_RUT_GON_9 §2–§3 (answers verified 14/11/2026)."""
import pytest

from app import mathcheck as m

P_ORIG = "sqrt(x)/(sqrt(x)-3) + 2*sqrt(x)/(sqrt(x)+3) - (3*x+9)/(x-9)"
ASSUME = ["x >= 0", "x != 9"]


def test_916_equivalent_but_not_fully_simplified():
    r = m.simplify_check("(-3*sqrt(x)-9)/(x-9)", P_ORIG, assumptions=ASSUME)
    assert r["equivalent"] is True
    assert r["fully_simplified"] is False
    assert r["common_factor"] == "sqrt(x) + 3"


def test_916_final_answer_ok():
    r = m.simplify_check("3/(3-sqrt(x))", P_ORIG, assumptions=ASSUME)
    assert r == {"equivalent": True, "fully_simplified": True, "common_factor": None}


def test_wrong_simplification_is_not_equivalent():
    r = m.simplify_check("3/(3+sqrt(x))", P_ORIG, assumptions=ASSUME)
    assert r["equivalent"] is False


def test_value_at_7_minus_4sqrt3():
    r = m.evaluate("3/(3-sqrt(x))", value="7-4*sqrt(3)")
    assert m.equivalent(r["exact"], "3*(sqrt(3)-1)/2")["equivalent"] is True


def test_p_equals_half_has_no_solution():
    r = m.solve("3/(3-sqrt(x)) = 1/2", assumptions=ASSUME)
    assert r["no_real_solution"] is True


def test_p_equals_three_halves():
    assert m.solve("3/(3-sqrt(x)) = 3/2", assumptions=ASSUME)["solutions"] == ["1"]


def test_95_rational_equation_excludes_domain():
    r = m.solve("(6*x-x**2)/(x**2-2*x) + x/(x-2) = 3/x")
    assert r["solutions"] == ["-2"]


def test_96_inequality_direction():
    assert m.inequality("(x+1)/3 >= 2*x - 1")["solution_set"] == "Interval(-oo, 4/5)"


def test_check_root():
    assert m.check_root("x**2 - 5*x + 6 = 0", "2")["is_root"] is True
    assert m.check_root("x**2 - 5*x + 6 = 0", "1")["is_root"] is False


def test_rounding():
    assert m.evaluate("3.5*tan(41*pi/180)", round_to=0)["rounded"] == "3.0"


def test_forbidden_input_rejected():
    with pytest.raises(m.MathInputError):
        m.equivalent("__import__('os')", "1")

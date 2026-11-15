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


# --- G4 (phụ huynh chốt Q4, 15/11/2026): systems of equations, gcd / lcm ---
def test_solve_system_two_workers():  # BO_TEST 9.1: together 16 h; I works 3 h + II works 6 h = 25 %
    r = m.solve_system(["1/x + 1/y = 1/16", "3/x + 6/y = 1/4"], ["x", "y"])
    assert r == {"solutions": [{"x": "24", "y": "48"}], "no_solution": False}


def test_solve_system_linear_and_no_solution():
    assert m.solve_system(["x + y = 5", "x - y = 1"], ["x", "y"]) == {"solutions": [{"x": "3", "y": "2"}], "no_solution": False}
    assert m.solve_system(["x + y = 1", "x + y = 2"], ["x", "y"]) == {"solutions": [], "no_solution": True}


def test_check_solution():
    eqs = ["x + y = 5", "x - y = 1"]
    assert m.check_solution(eqs, {"x": "3", "y": "2"}) == {"satisfies": True, "failed": []}
    assert m.check_solution(eqs, {"x": "4", "y": "1"}) == {"satisfies": False, "failed": [1]}
    assert m.check_solution(["1/x + 1/y = 1/16"], {"x": "24", "y": "48"}) == {"satisfies": True, "failed": []}


def test_check_solution_undefined_point_fails():
    assert m.check_solution(["1/x = 1"], {"x": "0"}) == {"satisfies": False, "failed": [0]}


def test_lcm_gcd_grade6():  # BO_TEST 6.9: ships every 10, 12, 15 days
    assert m.evaluate("lcm(10, 12, 15)")["exact"] == "60"
    assert m.evaluate("gcd(24, 36)")["exact"] == "12"


def test_system_rejects_bad_input():
    with pytest.raises(m.MathInputError):
        m.solve_system(["x = 1"], ["__x"])
    with pytest.raises(m.MathInputError):
        m.solve_system(["x = 1", "y = 2", "z = 3", "w = 4"], ["x", "y", "z", "w"])

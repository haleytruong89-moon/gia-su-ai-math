from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_rejects_missing_secret(monkeypatch):
    monkeypatch.setenv("CAS_SECRET", "s3cret")
    r = client.post("/check", json={"mode": "equivalent", "args": {"expr_a": "x", "expr_b": "x"}})
    assert r.status_code == 401


def test_runs_mode_with_secret(monkeypatch):
    monkeypatch.setenv("CAS_SECRET", "s3cret")
    r = client.post("/check", headers={"x-cas-secret": "s3cret"},
                    json={"mode": "check_root", "args": {"equation": "x - 2 = 0", "value": "2"}})
    assert r.json() == {"ok": True, "result": {"is_root": True, "undefined": False}}


def test_bad_input_is_an_error_not_a_crash(monkeypatch):
    monkeypatch.setenv("CAS_SECRET", "s3cret")
    r = client.post("/check", headers={"x-cas-secret": "s3cret"},
                    json={"mode": "equivalent", "args": {"expr_a": "__import__('os')", "expr_b": "1"}})
    assert r.json()["ok"] is False

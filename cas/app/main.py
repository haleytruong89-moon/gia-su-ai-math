"""Private HTTP wrapper for math_check. Only the gia-su-ai server calls it (shared secret header).

POST /check  {"mode": "...", "args": {...}}  →  {"ok": true, "result": {...}} | {"ok": false, "error": "..."}
"""
import hmac
import os
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from . import mathcheck

app = FastAPI(title="gia-su-ai cas", docs_url=None, redoc_url=None, openapi_url=None)
TIME_LIMIT_S = 4


class CheckRequest(BaseModel):
    mode: str
    args: dict


# A stuck SymPy call cannot be killed from Python; the request still answers "timeout" on time
# and the serverless instance is recycled by the platform.
_POOL = ThreadPoolExecutor(max_workers=2)


@app.post("/check")
def check(req: CheckRequest, x_cas_secret: str = Header(default="")):
    secret = os.environ.get("CAS_SECRET", "")
    if not secret or not hmac.compare_digest(x_cas_secret, secret):
        raise HTTPException(status_code=401, detail="unauthorized")
    fn = mathcheck.MODES.get(req.mode)
    if fn is None:
        return {"ok": False, "error": f"unknown mode {req.mode}"}
    future = _POOL.submit(fn, **req.args)
    try:
        return {"ok": True, "result": future.result(timeout=TIME_LIMIT_S)}
    except (mathcheck.MathInputError, TypeError) as exc:
        return {"ok": False, "error": str(exc)}
    except FutureTimeout:
        return {"ok": False, "error": "timeout"}


@app.get("/health")
def health():
    return {"ok": True}

// lib/tools/casClient.ts — the private math checker (cas/: FastAPI + SymPy), reached through the Vercel
// service binding (D24, G4). The binding only makes it reachable; the shared secret still authenticates.
export type CasResult = { ok: true; result: Record<string, unknown> } | { ok: false; error: string };
export interface CasClient {
  check(mode: string, args: Record<string, unknown>): Promise<CasResult>;
  health(): Promise<boolean>;
}

/** cas stops a SymPy call at 4 s; the server waits 5 s at most (DESIGN §5). */
export const CAS_TIMEOUT_MS = 5000;

export function httpCas(baseUrl: string, secret: string, timeoutMs = CAS_TIMEOUT_MS, fetchImpl: typeof fetch = fetch): CasClient {
  const base = baseUrl.replace(/\/+$/, "");
  async function call(path: string, init: RequestInit, ms: number): Promise<Response | "timeout" | "unreachable"> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetchImpl(`${base}${path}`, { ...init, signal: ctrl.signal, cache: "no-store" });
    } catch (e) {
      return e instanceof Error && e.name === "AbortError" ? "timeout" : "unreachable";
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    async check(mode, args) {
      const res = await call("/check", {
        method: "POST",
        headers: { "content-type": "application/json", "x-cas-secret": secret },
        body: JSON.stringify({ mode, args }),
      }, timeoutMs);
      if (res === "timeout") return { ok: false, error: "timeout" };
      if (res === "unreachable") return { ok: false, error: "cas_unreachable" };
      if (!res.ok) return { ok: false, error: `cas_http_${res.status}` };
      const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: unknown; error?: unknown } | null;
      if (body?.ok === true && body.result && typeof body.result === "object") return { ok: true, result: body.result as Record<string, unknown> };
      return { ok: false, error: typeof body?.error === "string" ? body.error : "cas_bad_reply" };
    },
    async health() {
      const res = await call("/health", { method: "GET" }, 3000);
      if (typeof res === "string" || !res.ok) return false;
      const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      return body?.ok === true;
    },
  };
}

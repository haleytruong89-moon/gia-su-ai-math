import { describe, expect, it } from "vitest";
import { httpCas } from "@/lib/tools/casClient";

const fake = (status: number, body: unknown, delayMs = 0): typeof fetch => async (_u, init) => {
  await new Promise((resolve, reject) => {
    const t = setTimeout(resolve, delayMs);
    init?.signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("aborted", "AbortError")); });
  });
  return new Response(JSON.stringify(body), { status });
};

describe("httpCas (private math_check service)", () => {
  it("posts mode + args with the secret header and returns the cas answer", async () => {
    let seen: { url: string; headers: Headers; body: unknown } | null = null;
    const f: typeof fetch = async (u, init) => {
      seen = { url: String(u), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) };
      return new Response(JSON.stringify({ ok: true, result: { is_root: true, undefined: false } }));
    };
    const r = await httpCas("http://cas.local/", "s3", 5000, f).check("check_root", { equation: "x - 2 = 0", value: "2" });
    expect(r).toEqual({ ok: true, result: { is_root: true, undefined: false } });
    expect(seen!.url).toBe("http://cas.local/check");
    expect(seen!.headers.get("x-cas-secret")).toBe("s3");
    expect(seen!.body).toEqual({ mode: "check_root", args: { equation: "x - 2 = 0", value: "2" } });
  });
  it("timeout, HTTP errors, network errors and cas errors come back as { ok: false } — never a throw", async () => {
    expect(await httpCas("http://cas", "s", 20, fake(200, {}, 500)).check("x", {})).toEqual({ ok: false, error: "timeout" });
    expect(await httpCas("http://cas", "s", 5000, fake(500, {})).check("x", {})).toEqual({ ok: false, error: "cas_http_500" });
    expect(await httpCas("http://cas", "s", 5000, fake(401, {})).check("x", {})).toEqual({ ok: false, error: "cas_http_401" });
    const down: typeof fetch = async () => { throw new TypeError("fetch failed"); };
    expect(await httpCas("http://cas", "s", 5000, down).check("x", {})).toEqual({ ok: false, error: "cas_unreachable" });
    expect(await httpCas("http://cas", "s", 5000, fake(200, { ok: false, error: "timeout" })).check("x", {})).toEqual({ ok: false, error: "timeout" });
  });
  it("health is true only on a 200 with ok", async () => {
    expect(await httpCas("http://cas", "s", 5000, fake(200, { ok: true })).health()).toBe(true);
    expect(await httpCas("http://cas", "s", 5000, fake(404, {})).health()).toBe(false);
  });
});

import { getActor } from "@/lib/auth";
import { casUrl, serverEnv } from "@/lib/env";
import { httpCas } from "@/lib/tools/casClient";

export const dynamic = "force-dynamic";

/** Parent only: is the private math checker reachable from this deployment? (G4 PR A test step.) */
export async function GET() {
  const actor = await getActor();
  if (actor?.role !== "parent") return Response.json({ error: "Chỉ bố mẹ dùng được." }, { status: 401 });
  const env = serverEnv();
  const url = casUrl(env);
  if (!url || !env.CAS_SECRET) {
    return Response.json({ health: false, sample: { ok: false, error: !url ? "no_cas_url" : "no_cas_secret" } }, { headers: { "Cache-Control": "no-store" } });
  }
  const cas = httpCas(url, env.CAS_SECRET);
  const [health, sample] = await Promise.all([cas.health(), cas.check("check_root", { equation: "x - 2 = 0", value: "2" })]);
  return Response.json({ health, sample, via: env.CAS_URL ? "CAS_URL" : "binding" }, { headers: { "Cache-Control": "no-store" } });
}

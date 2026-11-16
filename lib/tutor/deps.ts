import "server-only";
// lib/tutor/deps.ts — real dependencies for the route handlers.
import { realClient } from "@/lib/anthropic";
import { getActor } from "@/lib/auth";
import { supabaseRepo } from "@/lib/db/supabaseRepo";
import { casUrl, serverEnv } from "@/lib/env";
import { httpCas } from "@/lib/tools/casClient";
import { fakeAllowed, fakeClient } from "@/lib/tutor/fakeClient";
import { readBody } from "@/lib/tutor/form";
import type { Deps } from "@/lib/tutor/handlers";
import { loadLayers, promptVersion } from "@/lib/tutor/layers";

export async function liveDeps(): Promise<Deps> {
  const env = serverEnv();
  return {
    repo: supabaseRepo(undefined, env.TUTOR_MODEL_STRONG),
    // e2e only (TUTOR_FAKE_MODEL=1, never on Vercel): canned replies, no API call.
    client: fakeAllowed(process.env) ? fakeClient() : realClient(env.ANTHROPIC_API_KEY),
    actor: await getActor(),
    now: new Date(),
    layers: loadLayers(),
    promptVersion: promptVersion(),
    // The private math checker: Vercel binding (CAS_SERVICE_URL) or CAS_URL, with the shared secret.
    cas: (() => { const url = casUrl(env); return url && env.CAS_SECRET ? httpCas(url, env.CAS_SECRET) : null; })(),
    models: { main: env.TUTOR_MODEL_MAIN, strong: env.TUTOR_MODEL_STRONG, light: env.TUTOR_MODEL_LIGHT },
  };
}

type Handler = (d: Deps, body: unknown) => Promise<{ status: number; json: unknown }>;

/** Runs a handler with real dependencies. Errors are logged by message only (never the child's text). */
export async function serve(handler: Handler, req: Request): Promise<Response> {
  try {
    const body = await readBody(req); // JSON, or multipart with a photo (G3)
    const r = await handler(await liveDeps(), body);
    return Response.json(r.json, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("tutor route failed", e instanceof Error ? e.message : "unknown");
    return Response.json({ error: "server" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

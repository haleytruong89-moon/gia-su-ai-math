import "server-only";
// lib/tutor/deps.ts — real dependencies for the route handlers.
import { realClient } from "@/lib/anthropic";
import { getActor } from "@/lib/auth";
import { supabaseRepo } from "@/lib/db/supabaseRepo";
import { serverEnv } from "@/lib/env";
import type { Deps } from "@/lib/tutor/handlers";
import { loadLayers, promptVersion } from "@/lib/tutor/layers";

export async function liveDeps(): Promise<Deps> {
  const env = serverEnv();
  return {
    repo: supabaseRepo(),
    client: realClient(env.ANTHROPIC_API_KEY),
    actor: await getActor(),
    now: new Date(),
    layers: loadLayers(),
    promptVersion: promptVersion(),
    modelMain: env.TUTOR_MODEL_MAIN,
  };
}

type Handler = (d: Deps, body: unknown) => Promise<{ status: number; json: unknown }>;

/** Runs a handler with real dependencies. Errors are logged by message only (never the child's text). */
export async function serve(handler: Handler, req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => null);
    const r = await handler(await liveDeps(), body);
    return Response.json(r.json, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("tutor route failed", e instanceof Error ? e.message : "unknown");
    return Response.json({ error: "server" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

import { getActor } from "@/lib/auth";
import { supabaseRepo } from "@/lib/db/supabaseRepo";

export const dynamic = "force-dynamic";

/**
 * The reference solution of the child's OWN self_solved problem (G4 Q3, G7 P4). Only after self_solved,
 * only when cas confirmed it (X5). `pending` while it is still being written (right after the turn).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (actor?.role !== "child") return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const repo = supabaseRepo();
    const problem = await repo.getProblemForChild(id, actor.userId);
    if (!problem || problem.status !== "self_solved") return Response.json({ error: "not_found" }, { status: 404 });
    const ref = await repo.getReference(id, actor.userId);
    return Response.json(ref ?? { pending: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("solution read failed", e instanceof Error ? e.message : "unknown");
    return Response.json({ error: "server" }, { status: 500 });
  }
}

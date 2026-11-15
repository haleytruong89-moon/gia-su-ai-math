import { getActor } from "@/lib/auth";
import { saveProfile } from "@/lib/parent/profiles";

export const dynamic = "force-dynamic";

/** Parent only: save a new teaching-profile version for a child of the family, or pause it. */
export async function POST(req: Request) {
  const actor = await getActor();
  if (actor?.role !== "parent") return Response.json({ error: "Chỉ bố mẹ dùng được." }, { status: 403 });
  try {
    const err = await saveProfile(actor, await req.json().catch(() => null));
    return err ? Response.json({ error: err }, { status: 400 }) : Response.json({ ok: true });
  } catch (e) {
    console.error("profile save failed", e instanceof Error ? e.message : "unknown");
    return Response.json({ error: "Máy chủ lỗi, thử lại sau." }, { status: 500 });
  }
}

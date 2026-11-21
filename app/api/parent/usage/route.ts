import { getActor } from "@/lib/auth";
import { supabaseRepo } from "@/lib/db/supabaseRepo";

export const dynamic = "force-dynamic";

/** Parent only: "Bật lại Opus" after raising the cap in the Console (DOMAIN §4.5 c, TODO(rule-unconfirmed): still *Đề xuất*). */
export async function POST(req: Request) {
  const actor = await getActor();
  if (actor?.role !== "parent") return Response.json({ error: "Chỉ bố mẹ dùng được." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  if (body?.action !== "resume_strong") return Response.json({ error: "Yêu cầu chưa đúng dạng." }, { status: 400 });
  try {
    await supabaseRepo().resumeStrong(actor.familyId, new Date());
    return Response.json({ ok: true });
  } catch (e) {
    console.error("resume strong failed", e instanceof Error ? e.message : "unknown");
    return Response.json({ error: "Máy chủ lỗi, thử lại sau." }, { status: 500 });
  }
}

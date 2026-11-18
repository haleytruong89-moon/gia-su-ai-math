import { after } from "next/server";
import { getActor } from "@/lib/auth";
import { proposeFromFeedback } from "@/lib/parent/rules";
import { liveModel } from "@/lib/tutor/deps";
import { loadLayers, promptVersion } from "@/lib/tutor/layers";
import { saveFeedback } from "@/lib/parent/feedback";
import { parseFeedback } from "@/lib/parent/feedbackInput";

export const dynamic = "force-dynamic";

/** Parent only: 👍/👎 (+ note) on one tutor turn of a problem of the family. */
export async function POST(req: Request) {
  const actor = await getActor();
  if (actor?.role !== "parent") return Response.json({ error: "Chỉ bố mẹ dùng được." }, { status: 403 });
  const input = parseFeedback(await req.json().catch(() => null));
  if (!input) return Response.json({ error: "Góp ý chưa đúng dạng (ghi chú tối đa 500 ký tự)." }, { status: 400 });
  try {
    const r = await saveFeedback(actor, input, new Date());
    if (!r.ok) return Response.json({ error: "Không tìm thấy lượt này." }, { status: 404 });
    // P3: a note becomes a proposed teaching rule (Sonnet drafts it after the answer; never blocks the page).
    if (input.note) {
      const m = liveModel();
      const prompt = loadLayers().ruleDraft ?? "";
      after(() => proposeFromFeedback(actor, r.feedbackId, { client: m.client, model: m.main, prompt, promptVersion: promptVersion(), now: new Date() }));
    }
    return Response.json({ ok: true, feedbackId: r.feedbackId });
  } catch (e) {
    console.error("feedback save failed", e instanceof Error ? e.message : "unknown");
    return Response.json({ error: "Máy chủ lỗi, thử lại sau." }, { status: 500 });
  }
}

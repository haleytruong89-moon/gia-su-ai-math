import { getActor } from "@/lib/auth";
import { parseRuleAction, RULE_ERROR_TEXT } from "@/lib/parent/ruleActions";
import { applyRuleAction } from "@/lib/parent/rules";

export const dynamic = "force-dynamic";

/** Parent only: approve / reject / retire / edit a teaching rule, or write one (§3.4, X3). */
export async function POST(req: Request) {
  const actor = await getActor();
  if (actor?.role !== "parent") return Response.json({ error: "Chỉ bố mẹ dùng được." }, { status: 403 });
  const action = parseRuleAction(await req.json().catch(() => null));
  if (!action) return Response.json({ error: "Yêu cầu chưa đúng dạng." }, { status: 400 });
  try {
    const err = await applyRuleAction(actor, action, new Date());
    if (err) return Response.json({ error: RULE_ERROR_TEXT[err] }, { status: err === "not_found" ? 404 : 409 });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("rule action failed", e instanceof Error ? e.message : "unknown");
    return Response.json({ error: "Máy chủ lỗi, thử lại sau." }, { status: 500 });
  }
}

import { getActor } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { launcherNotify } from "@/lib/notify";

export const dynamic = "force-dynamic";

/** Parent only: "Gửi thử thông báo tiền" — one 'burn' push with a sample forecast, to check the setup (SETUP Launcher I5). */
export async function POST() {
  const actor = await getActor();
  if (actor?.role !== "parent") return Response.json({ error: "Chỉ bố mẹ dùng được." }, { status: 403 });
  const env = serverEnv();
  if (!env.LAUNCHER_URL || !env.TUTOR_NOTIFY_SECRET) {
    return Response.json({ error: "Chưa đặt LAUNCHER_URL hoặc TUTOR_NOTIFY_SECRET trên Vercel (SETUP Launcher mục I)." }, { status: 503 });
  }
  const sent = await launcherNotify(env)("burn", actor.familyId, 60);
  return sent ? Response.json({ ok: true }) : Response.json({ error: "Launcher không nhận (kiểm tra khóa ở cả 2 project)." }, { status: 502 });
}

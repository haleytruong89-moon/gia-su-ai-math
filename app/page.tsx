import Link from "next/link";
import { getEntry } from "@/lib/auth";
import { PARENT_BACK, TopBar } from "./top-bar";
import { StartForm } from "./start-form";
import { ReviewBlock } from "./review-block";
import { supabaseRepo } from "@/lib/db/supabaseRepo";
import { dueReviews, type DueReview } from "@/lib/tutor/review";

export const dynamic = "force-dynamic";

const NOT_READY = {
  no_teaching_profile: "Bố mẹ chưa bật cô gia sư cho em. Em nhờ bố mẹ vào trang Hồ sơ dạy học nhé.",
  grade_not_supported: "Cô gia sư hiện chỉ dạy lớp 6 và lớp 9.",
  no_profile: "Tài khoản này chưa dùng được cô gia sư. Em nhờ bố mẹ xem giúp nhé.",
} as const;

export default async function Home({ searchParams }: { searchParams: Promise<{ task?: string; thay?: string }> }) {
  const entry = await getEntry();
  const params = await searchParams;
  const task = params.task?.slice(0, 120) || null;
  // "Chụp lại ảnh khác" (G3 Q3): the server checks that this problem is the child's own and still unconfirmed.
  const replaces = params.thay && /^[0-9a-f-]{36}$/i.test(params.thay) ? params.thay : null;

  if (entry.kind === "signed_out") {
    return (
      <>
        <TopBar />
        <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
          <h1 className="text-2xl font-bold">Cô gia sư Toán</h1>
          <p>Em mở cô gia sư từ Góc học tập trong Study Launcher nhé.</p>
          <a href="/login?next=/gia-su" className="btn self-start bg-accent text-white no-underline">Đăng nhập</a>
        </main>
      </>
    );
  }
  if (entry.kind === "parent") {
    return (
      <>
        <TopBar back={PARENT_BACK} />
        <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
          <h1 className="text-2xl font-bold">Cô gia sư Toán · bố mẹ</h1>
          <p>Bật cô gia sư cho từng con bằng hồ sơ dạy học đã duyệt.</p>
          <Link href="/bo-me" className="btn self-start bg-accent text-white no-underline">Hồ sơ dạy học</Link>
        </main>
      </>
    );
  }
  if (entry.kind === "child_not_ready") {
    return (
      <>
        <TopBar />
        <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
          <h1 className="text-2xl font-bold">Cô gia sư Toán</h1>
          <p>{NOT_READY[entry.reason]}</p>
        </main>
      </>
    );
  }
  // G6b (D26): ≤ 2 review questions first (Y5). A failing read never hides the page.
  let due: DueReview[] = [];
  try {
    due = await dueReviews(supabaseRepo(), entry.actor.userId, new Date());
  } catch (e) {
    console.error("due reviews failed", e instanceof Error ? e.message : "unknown");
  }
  return (
    <>
      <TopBar />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        {due.length > 0 && <ReviewBlock due={due} />}
        <h1 className="text-2xl font-bold">Em kẹt bài nào?</h1>
        {task && <p className="rounded-xl bg-white px-3 py-2 text-sm text-ink/80">Bài đang làm: <b>{task}</b></p>}
        <p className="text-sm text-ink/70">Cô hỏi gợi ý từng bước để em tự làm, cô không làm hộ. Em chụp ảnh đề hoặc gõ đề vào ô dưới.</p>
        <StartForm replaces={replaces} />
      </main>
    </>
  );
}

import { redirect } from "next/navigation";
import { getEntry } from "@/lib/auth";
import { familyChildren } from "@/lib/parent/profiles";
import { profileDefaults } from "@/lib/profileForm";
import { PARENT_BACK, TopBar } from "../top-bar";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

/** Hồ sơ dạy học (layer ④): parents only. The text lives in the database, never in the public repo. */
export default async function ParentPage() {
  const entry = await getEntry();
  if (entry.kind !== "parent") redirect("/");
  const kids = await familyChildren(entry.actor);
  return (
    <>
      <TopBar back={PARENT_BACK} />
      <main className="mx-auto flex max-w-2xl flex-col gap-5 p-4">
        <nav className="flex flex-wrap gap-2">
          <a href="/gia-su/bo-me/bao-cao" className="btn bg-accent text-white no-underline">Báo cáo tối ›</a>
        </nav>
        <h1 className="text-2xl font-bold">Hồ sơ dạy học</h1>
        <p className="text-sm text-ink/75">
          Dán hồ sơ đã duyệt từ hub (mục ④ của system prompt). Chỉ dùng <b>mã con</b> (HS-9A, HS-6A) — cô gia sư không được biết họ tên, trường.
          Mỗi lần lưu là một phiên bản mới. Con chỉ dùng được cô gia sư khi có hồ sơ đang bật.
        </p>
        <p className="rounded-xl bg-[#FFF4E0] px-3 py-2 text-sm">
          Bản G1 (thử nghiệm): cô chưa có bộ kiểm tra câu trả lời và chưa có máy tính đại số. Bố mẹ thử trước; chỉ bật cho con khi đã sẵn sàng.
        </p>
        {kids.length === 0 && <p>Gia đình chưa có tài khoản con.</p>}
        {kids.map((k) => {
          const grade = k.grade === 6 || k.grade === 9 ? k.grade : null;
          return (
            <section key={k.childId} className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
              <h2 className="text-lg font-bold">
                {k.name} · {k.grade ? `lớp ${k.grade}` : "chưa có lớp"}
              </h2>
              {grade === null ? (
                <p className="text-sm text-ink/70">Gia sư v1 chỉ dành cho lớp 6 và lớp 9.</p>
              ) : (
                <ProfileForm
                  childId={k.childId}
                  current={k.current}
                  defaults={{ childCode: `HS-${grade}A`, ...profileDefaults(grade) }}
                />
              )}
            </section>
          );
        })}
      </main>
    </>
  );
}

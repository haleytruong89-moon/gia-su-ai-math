import { redirect } from "next/navigation";
import { getEntry } from "@/lib/auth";
import { familyRules } from "@/lib/parent/rules";
import { REASON_LABEL } from "@/lib/report/labels";
import { MAX_ACTIVE_RULES } from "@/lib/rules/teachingRules";
import { TopBar } from "../../top-bar";
import { ActiveRule, NewRule, ProposedRule } from "./rule-editor";

export const dynamic = "force-dynamic";

const sourceText = (r: { source: string; sourceKey: string | null }) => {
  if (r.source === "child_rating") {
    const reason = r.sourceKey?.replace(/^rating:/, "") ?? "";
    return `Từ lời chấm của con, 2 buổi liền: "${REASON_LABEL[reason] ?? reason}"`;
  }
  if (r.source === "parent_feedback") return "Cô soạn từ góp ý của bố mẹ";
  return "Bố mẹ tự viết";
};

/** Luật dạy (US8): proposals to approve, rules in use, write a new one. Parents only. */
export default async function RulesPage() {
  const entry = await getEntry();
  if (entry.kind !== "parent") redirect("/");
  const kids = await familyRules(entry.actor);
  return (
    <>
      <TopBar back={{ href: "/gia-su/bo-me", label: "← Hồ sơ dạy học" }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <h1 className="text-2xl font-bold">Luật dạy</h1>
        <p className="text-sm text-ink/75">
          Luật chỉnh <b>cách</b> cô dạy (độ dài, từ ngữ, nhịp hỏi). Luật mới có hiệu lực từ <b>buổi học sau</b>. Mỗi con tối đa {MAX_ACTIVE_RULES} luật đang dùng.
          Cô không bao giờ được trái luật gốc (không lộ lời giải).
        </p>
        {kids.length === 0 && <p>Gia đình chưa có tài khoản con.</p>}
        {kids.map((k) => {
          const proposed = k.rules.filter((r) => r.status === "proposed");
          const active = k.rules.filter((r) => r.status === "approved").sort((a, b) => a.version - b.version);
          return (
            <section key={k.childId} className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
              <h2 className="text-lg font-bold">
                {k.name}
                {k.grade ? ` · lớp ${k.grade}` : ""}
              </h2>
              <h3 className="font-semibold">Chờ duyệt ({proposed.length})</h3>
              {proposed.length === 0 && <p className="text-sm text-ink/60">Không có luật nào chờ duyệt.</p>}
              {proposed.map((r) => (
                <ProposedRule key={r.id} id={r.id} text={r.text} source={sourceText(r)}
                  reviewHref={r.problemId ? `/gia-su/bo-me/bao-cao/${r.problemId}` : null} />
              ))}
              <h3 className="font-semibold">Đang dùng ({active.length}/{MAX_ACTIVE_RULES})</h3>
              {active.length === 0 && <p className="text-sm text-ink/60">Chưa có luật nào.</p>}
              {active.map((r) => (
                <ActiveRule key={r.id} id={r.id} text={r.text} version={r.version} source={sourceText(r)}
                  approvedAt={r.approvedAt ? new Date(r.approvedAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : null} />
              ))}
              <NewRule childId={k.childId} />
            </section>
          );
        })}
      </main>
    </>
  );
}

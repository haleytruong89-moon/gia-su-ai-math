import { notFound, redirect } from "next/navigation";
import { getEntry } from "@/lib/auth";
import { lines } from "@/lib/markdown";
import { STATUS_LABEL } from "@/lib/report/labels";
import { kuTitle, loadParentThread } from "@/lib/report/load";
import { TopBar } from "../../../top-bar";
import { FeedbackButtons } from "../feedback-buttons";

export const dynamic = "force-dynamic";

/** One problem, turn by turn, for the parents (US7) with 👍/👎 + note on each tutor turn (US8 input). */
export default async function ProblemReviewPage({ params }: { params: Promise<{ problemId: string }> }) {
  const entry = await getEntry();
  if (entry.kind !== "parent") redirect("/");
  const { problemId } = await params;
  const t = await loadParentThread(entry.actor, problemId);
  if (!t) notFound();
  const p = t.problem;
  return (
    <>
      <TopBar back={{ href: `/gia-su/bo-me/bao-cao?ngay=${t.date}`, label: "← Báo cáo tối" }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <section className="rounded-2xl border border-ink/10 bg-white p-4">
          <h1 className="text-lg font-bold">{p.ku_code ? `${p.ku_code}${p.kuTitle ? ` — ${p.kuTitle}` : ""}` : "Bài chưa rõ mã SGK"}</h1>
          <p className="text-sm text-ink/75">
            {STATUS_LABEL[p.status]} · gợi ý tới H{p.hint_level_max} · hiểu U{p.u_level}
            {p.exam_slot ? ` · ${p.exam_slot}` : ""}
          </p>
          {(p.prereq_gaps ?? []).length > 0 && (
            <p className="text-sm">Lỗ hổng nền: {(p.prereq_gaps ?? []).map((c) => (kuTitle(c) ? `${c} — ${kuTitle(c)}` : c)).join("; ")}</p>
          )}
          {p.confirmed_statement && <p className="mt-2 text-sm">Đề: {p.confirmed_statement}</p>}
        </section>
        {t.reference && (
          <section className="rounded-2xl border border-ink/10 bg-white p-4">
            <h2 className="font-semibold">Lời giải tham khảo (máy đã kiểm đáp số)</h2>
            <ol className="list-decimal pl-5">
              {t.reference.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            {t.reference.finalAnswer && <p className="mt-1"><b>Đáp số:</b> {t.reference.finalAnswer}</p>}
          </section>
        )}
        <ol className="flex flex-col gap-3">
          {t.messages.map((m) => (
            <li key={m.id} className={`rounded-2xl px-4 py-3 ${m.role === "tutor" ? "bg-white" : "bg-accent/10"}`}>
              <p className="mb-1 text-xs font-semibold text-ink/60">{m.role === "tutor" ? "Cô" : "Con"}</p>
              {m.images.map((src) => (
                <a key={src} href={src} target="_blank" rel="noreferrer" className="mb-2 block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                  <img src={src} alt="Ảnh con gửi" className="max-h-60 rounded-xl" />
                </a>
              ))}
              {lines(m.text).map((runs, i) => (
                <p key={i} className="min-h-[1em]">
                  {runs.map((r, j) => (r.bold ? <b key={j}>{r.text}</b> : <span key={j}>{r.text}</span>))}
                </p>
              ))}
              {m.buttons.length > 0 && <p className="mt-1 text-sm text-ink/60">Nút: {m.buttons.join(" · ")}</p>}
              {m.role === "tutor" && <FeedbackButtons problemId={t.problemId} messageId={m.id} initial={t.feedback[m.id] ?? null} />}
            </li>
          ))}
        </ol>
      </main>
    </>
  );
}

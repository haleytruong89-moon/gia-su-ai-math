import { redirect } from "next/navigation";
import { getEntry } from "@/lib/auth";
import { dayLabel, FACE_LABEL, REASON_LABEL, reportDate, STATUS_LABEL } from "@/lib/report/labels";
import { loadDayReport, type ChildDay } from "@/lib/report/load";
import { addDays, dateVn } from "@/lib/time";
import { TopBar } from "../../top-bar";

export const dynamic = "force-dynamic";

const BACK = { href: "/gia-su/bo-me", label: "← Hồ sơ dạy học" } as const;

function Child({ c }: { c: ChildDay }) {
  const solved = c.problems.filter((p) => p.status === "self_solved").length;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
      <h2 className="text-lg font-bold">
        {c.name}
        {c.grade ? ` · lớp ${c.grade}` : ""}
      </h2>
      {c.sessions === 0 ? (
        <p className="text-ink/70">Hôm nay con chưa học với cô.</p>
      ) : (
        <p className="text-sm text-ink/75">
          {c.minutes}′ · {c.sessions} buổi · {c.problems.length} bài · {solved} tự làm xong
        </p>
      )}
      {c.flags.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-xl bg-[#FFF4E0] px-3 py-2 text-sm">
          {c.flags.map((f) => (
            <li key={f.kind}>
              ⚠️ {f.text}
              {f.problemIds.length > 0 && (
                <>
                  {" "}
                  {f.problemIds.map((id, i) => (
                    <a key={id} href={`#bai-${id}`} className="text-accent underline">
                      {i === 0 ? "xem" : `bài ${i + 1}`}
                    </a>
                  )).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, " · ", el] : [el]), [])}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {c.problems.length > 0 && (
        <ol className="flex flex-col gap-2">
          {c.problems.map((p) => (
            <li key={p.id} id={`bai-${p.id}`} className="rounded-xl border border-ink/10 p-3">
              <p className="text-sm font-semibold">
                {p.ku_code ? `${p.ku_code}${p.kuTitle ? ` — ${p.kuTitle}` : ""}` : "Chưa rõ bài SGK"}
                {p.exam_slot ? ` · ${p.exam_slot}` : ""}
              </p>
              <p className="text-sm text-ink/75">
                {STATUS_LABEL[p.status]} · gợi ý tới H{p.hint_level_max} · hiểu U{p.u_level}
                {p.nan_jumps > 0 ? ` · nản ${p.nan_jumps} lần` : ""}
              </p>
              {p.confirmed_statement && <p className="mt-1 line-clamp-2 text-sm">{p.confirmed_statement}</p>}
              <a href={`/gia-su/bo-me/bao-cao/${p.id}`} className="btn -ml-3 mt-1 text-accent no-underline">
                Xem lại ›
              </a>
            </li>
          ))}
        </ol>
      )}
      {c.ratings.length > 0 && (
        <p className="text-sm">
          Con chấm cô:{" "}
          {c.ratings
            .map((r) => [FACE_LABEL[r.face], ...r.reasons.map((x) => REASON_LABEL[x] ?? x)].join(", "))
            .join(" · ")}
        </p>
      )}
    </section>
  );
}

/** Báo cáo tối (US7): both children, one VN day, ≤ 5 minutes to read. Parents only. */
export default async function ReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const entry = await getEntry();
  if (entry.kind !== "parent") redirect("/");
  const now = new Date();
  const date = reportDate((await searchParams).ngay, now);
  const report = await loadDayReport(entry.actor, date);
  const today = dateVn(now);
  return (
    <>
      <TopBar back={BACK} />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <a href={`/gia-su/bo-me/bao-cao?ngay=${addDays(date, -1)}`} className="btn -ml-3 text-accent no-underline" aria-label="Hôm trước">
            ‹
          </a>
          <h1 className="text-xl font-bold">Báo cáo tối · {dayLabel(date)}</h1>
          {date < today ? (
            <a href={`/gia-su/bo-me/bao-cao?ngay=${addDays(date, 1)}`} className="btn -mr-3 text-accent no-underline" aria-label="Hôm sau">
              ›
            </a>
          ) : (
            <span className="w-11" />
          )}
        </div>
        <p className="rounded-xl bg-white px-3 py-2 text-sm">
          {report.cost.flag ?? `Chi phí tháng: ${report.cost.costUsd.toFixed(2).replace(".", ",")} / 50 USD`}
        </p>
        {report.children.length === 0 && <p>Gia đình chưa có tài khoản con.</p>}
        {report.children.map((c) => (
          <Child key={c.childId} c={c} />
        ))}
        <p className="text-xs text-ink/60">
          Cờ ⚠️ theo DOMAIN §4.7. Hai cờ đầu của mỗi con cũng hiện ở thẻ &quot;Học với app&quot; trên Launcher.
        </p>
      </main>
    </>
  );
}

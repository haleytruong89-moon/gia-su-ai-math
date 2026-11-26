// D38: "Bài của em" — the jobs of the child's own problem. The child works in the notebook and ticks each job;
// "Kẹt ở đây" asks the tutor about that job only. Buttons ≥ 44px (Boox ≥ 48px).
import { PLAN_HEAD } from "@/lib/rules/plan";

export function PlanList({ steps, ticks, active, onTick, onStuck }: {
  steps: string[]; ticks: number[]; active: boolean;
  onTick: (step: number, done: boolean) => void; onStuck: (step: number) => void;
}) {
  return (
    <section aria-label="Bài của em" className="mt-3 rounded-2xl border-[1.5px] border-accent/40 bg-[#FAFBF7] px-3 py-3">
      <h3 className="mb-2 font-semibold">{PLAN_HEAD}</h3>
      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => {
          const n = i + 1;
          const done = ticks.includes(n);
          return (
            <li key={n} className="flex items-center gap-2">
              <button type="button" disabled={!active} aria-pressed={done} onClick={() => onTick(n, !done)}
                className={`flex min-h-12 flex-1 items-center gap-3 rounded-xl border-[1.5px] px-3 py-2 text-left text-base ${done
                  ? "border-accent bg-[#EEF3F0]" : "border-ink/15 bg-white"} disabled:opacity-70`}>
                <span aria-hidden="true" className="text-xl">{done ? "✅" : "⬜"}</span>
                <span className={done ? "text-ink/70" : ""}><b>{n}.</b> {s}</span>
              </button>
              {active && !done && (
                <button type="button" onClick={() => onStuck(n)}
                  className="min-h-12 shrink-0 rounded-xl border-[1.5px] border-ink/20 bg-white px-3 text-sm font-semibold">
                  Kẹt ở đây
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

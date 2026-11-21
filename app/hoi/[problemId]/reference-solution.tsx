"use client";

import { useState } from "react";

type Ref = { steps: string[]; finalAnswer: string };
const TRIES = 6;

/** "Xem lời giải tham khảo" after the child solved the problem alone (G7 P4). Polls while it is being written. */
export function ReferenceSolution({ problemId }: { problemId: string }) {
  const [state, setState] = useState<{ kind: "idle" | "loading" | "none" } | { kind: "ready"; ref: Ref }>({ kind: "idle" });

  async function open() {
    setState({ kind: "loading" });
    for (let i = 0; i < TRIES; i++) {
      try {
        const res = await fetch(`/gia-su/api/problem/${problemId}/solution`, { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as Partial<Ref> & { pending?: boolean };
        if (res.ok && json.steps) {
          setState({ kind: "ready", ref: { steps: json.steps, finalAnswer: json.finalAnswer ?? "" } });
          return;
        }
        if (!res.ok || !json.pending) break;
      } catch {
        break;
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
    setState({ kind: "none" });
  }

  if (state.kind === "ready") {
    return (
      <section aria-label="Lời giải tham khảo" className="flex flex-col gap-1 rounded-2xl border border-ink/10 bg-white p-4">
        <p className="font-semibold">Lời giải tham khảo</p>
        <ol className="list-decimal pl-5">
          {state.ref.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
        {state.ref.finalAnswer && <p className="mt-1"><b>Đáp số:</b> {state.ref.finalAnswer}</p>}
        <p className="text-sm text-ink/60">Em so sánh với cách em làm nhé. Cách nào đúng cũng được!</p>
      </section>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <button type="button" disabled={state.kind === "loading"} onClick={() => void open()} className="btn self-start border-[1.5px] border-accent bg-white text-accent">
        {state.kind === "loading" ? "Cô đang viết…" : "Xem lời giải tham khảo"}
      </button>
      {state.kind === "none" && <p className="text-sm text-ink/70">Cô chưa viết xong lời giải tham khảo, em xem lại sau nhé.</p>}
    </div>
  );
}

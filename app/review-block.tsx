"use client";
// Start-of-session review (G6b, DOMAIN §4.11, D26): ≤ 2 questions above "Em kẹt bài nào?" (Y5), no timer (Y4).
import { useRef, useState } from "react";
import { REVIEW_COPY } from "@/lib/copy";
import { newClientMsgId, postWithRetry } from "@/lib/client/post";
import type { DueReview } from "@/lib/tutor/review";
import { CardView } from "./hoi/[problemId]/card-view";

type Answered = { result: "correct" | "wrong" | "skipped" | "unchecked"; answer: string | null; message?: string };

function Question({ q, onDone }: { q: DueReview; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [showCard, setShowCard] = useState(false);
  const pressId = useRef<string | null>(null);

  async function send(body: { answer: string } | { skipped: true }) {
    if (busy) return;
    pressId.current ??= newClientMsgId(); // one id per question: a retry is never graded twice
    setBusy(true);
    setError(null);
    const r = await postWithRetry<Answered>("/api/review/answer", { itemId: q.id, clientMsgId: pressId.current, ...body });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    if (r.data.result === "skipped") return onDone();
    if (r.data.result === "unchecked") pressId.current = null; // nothing was stored: the child may try again later
    setAnswered(r.data);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-bg p-3">
      <p className="text-base font-semibold">{q.prompt}</p>
      {q.kind === "recognize" && <p className="text-sm text-ink/70">{REVIEW_COPY.recognize}</p>}
      {!answered && (
        <>
          {q.buttons.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {q.buttons.map((b) => (
                <button key={b} type="button" disabled={busy} onClick={() => void send({ answer: b })}
                  className="btn border-[1.5px] border-accent bg-white text-accent disabled:opacity-50">{b}</button>
              ))}
            </div>
          ) : (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void send({ answer: text }); }}>
              <label className="flex flex-1">
                <span className="sr-only">Câu trả lời</span>
                <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder={REVIEW_COPY.placeholder}
                  className="min-h-11 flex-1 rounded-xl border-[1.5px] border-ink/15 bg-white px-3 text-base" />
              </label>
              <button type="submit" disabled={busy || !text.trim()} className="btn bg-accent text-white disabled:opacity-50">{REVIEW_COPY.answer}</button>
            </form>
          )}
          <button type="button" disabled={busy} onClick={() => void send({ skipped: true })}
            className="btn self-start border-[1.5px] border-ink/20 bg-white text-ink/70 disabled:opacity-50">{REVIEW_COPY.later}</button>
        </>
      )}
      {answered && (
        <div role="status" className="flex flex-col gap-2">
          {answered.result === "correct" && <p className="font-semibold text-accent">{REVIEW_COPY.correct}</p>}
          {answered.result === "wrong" && <p className="font-semibold">{REVIEW_COPY.wrong} {answered.answer}</p>}
          {answered.result === "unchecked" && <p>{answered.message ?? REVIEW_COPY.unchecked}</p>}
          <div className="flex flex-wrap gap-2">
            {q.cardCode && answered.result !== "unchecked" && (
              <button type="button" onClick={() => setShowCard((v) => !v)} className="btn border-[1.5px] border-ink/20 bg-white">{REVIEW_COPY.seeCard}</button>
            )}
            <button type="button" onClick={onDone} className="btn bg-accent text-white">Tiếp</button>
          </div>
          {showCard && q.cardCode && <CardView cardRef={`${q.cardCode}#1`} />}
        </div>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-[#A33A2B]">{error}</p>}
    </div>
  );
}

export function ReviewBlock({ due }: { due: DueReview[] }) {
  const [left, setLeft] = useState(due);
  if (!left.length) return null; // done (or nothing due): the page is the usual "Em kẹt bài nào?"
  const q = left[0]!;
  return (
    <section aria-label={REVIEW_COPY.title} className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4">
      <h2 className="text-lg font-bold">{REVIEW_COPY.title} {due.length} câu</h2>
      <Question key={q.id} q={q} onDone={() => setLeft((l) => l.slice(1))} />
    </section>
  );
}

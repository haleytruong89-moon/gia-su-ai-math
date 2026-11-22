"use client";
// "Cô sai ở đây" (D32): under each tutor message the child can say which kind of mistake it was and why.
// Parents read it in the evening report; the tutor never sees it.
import { useRef, useState } from "react";
import { newClientMsgId, postWithRetry } from "@/lib/client/post";
import { FLAG_COPY } from "@/lib/copy";
import { FEEDBACK_COMMENT_MAX, FEEDBACK_KINDS, FEEDBACK_LABEL, type FeedbackKind } from "@/lib/rules/feedback";

export function FlagMessage({ messageRef }: { messageRef: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<string | null>(null);

  if (sent) return <p role="status" className="mt-1 text-sm text-ink/70">{FLAG_COPY.thanks}</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn -ml-3 min-h-[44px] text-sm text-ink/60 no-underline">
        ⚑ {FLAG_COPY.open}
      </button>
    );
  }

  async function send() {
    if (!kind || busy) return;
    attempt.current ??= newClientMsgId();
    setBusy(true);
    setError(null);
    const r = await postWithRetry<{ status: string }>("/api/feedback", { messageRef, kind, comment: comment.trim() || null, clientMsgId: attempt.current });
    setBusy(false);
    if (r.ok) setSent(true);
    else setError(r.message);
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border-[1.5px] border-ink/15 bg-white p-3">
      <p className="text-sm font-semibold">{FLAG_COPY.ask}</p>
      <div className="flex flex-wrap gap-2">
        {FEEDBACK_KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} disabled={busy} onClick={() => setKind(k)}
            className={`btn border-[1.5px] text-sm ${kind === k ? "border-accent bg-accent/10" : "border-ink/15 bg-white"}`}>
            {FEEDBACK_LABEL[k]}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        {FLAG_COPY.commentLabel}
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={FEEDBACK_COMMENT_MAX} rows={3}
          placeholder={FLAG_COPY.placeholder} className="rounded-xl border-[1.5px] border-ink/15 p-2 text-base" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!kind || busy} onClick={() => void send()} className="btn bg-accent text-white disabled:opacity-50">
          {FLAG_COPY.send}
        </button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className="btn border-[1.5px] border-ink/20 bg-white">
          {FLAG_COPY.cancel}
        </button>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-[#A33A2B]">{error}</p>}
    </div>
  );
}

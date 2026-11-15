"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { deviceGuess, newClientMsgId, postWithRetry } from "@/lib/client/post";
import { STUCK_LABELS } from "@/lib/copy";

type Stuck = keyof typeof STUCK_LABELS;

export function StartForm() {
  const router = useRouter();
  const [stuck, setStuck] = useState<Stuck | null>(null);
  const [statement, setStatement] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One id per problem attempt: a resend after a network error reuses it (no second problem).
  const attempt = useRef<{ id: string; text: string } | null>(null);

  async function send() {
    const text = statement.trim();
    if (!text || busy) return;
    if (!attempt.current || attempt.current.text !== text) attempt.current = { id: newClientMsgId(), text };
    setBusy(true);
    setError(null);
    const r = await postWithRetry<{ problemId: string }>("/api/problem/new", {
      clientMsgId: attempt.current.id, stuckKind: stuck, statement: text, device: deviceGuess(),
    });
    if (r.ok) {
      router.push(`/hoi/${r.data.problemId}`);
      return;
    }
    if (r.status === 503) attempt.current = null; // the server dropped it: the next tap is a new attempt
    setError(r.message);
    setBusy(false);
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">Em đang kẹt ở đâu?</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STUCK_LABELS) as Stuck[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={stuck === k}
              onClick={() => setStuck(stuck === k ? null : k)}
              className={`btn border-[1.5px] ${stuck === k ? "border-accent bg-accent text-white" : "border-ink/15 bg-white"}`}
            >
              {STUCK_LABELS[k]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-2">
        <span className="font-semibold">Đề bài</span>
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          rows={6}
          maxLength={2000}
          placeholder="Gõ lại đề bài em đang làm…"
          className="rounded-xl border-[1.5px] border-ink/15 bg-white p-3 text-base"
        />
      </label>
      <p className="text-xs text-ink/60">Chụp ảnh đề sẽ có ở bản sau. Đừng gõ họ tên hay tên trường vào đây.</p>
      {error && <p role="alert" className="text-sm font-semibold text-[#A33A2B]">{error}</p>}
      <button type="submit" disabled={busy || !statement.trim()} className="btn self-start bg-accent text-white disabled:opacity-50">
        {busy ? "Cô đang đọc đề…" : "Gửi"}
      </button>
    </form>
  );
}

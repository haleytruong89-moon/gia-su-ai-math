"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Thread, ThreadMessage } from "@/lib/db/supabaseRepo";
import { lines } from "@/lib/markdown";
import { newClientMsgId, postWithRetry } from "@/lib/client/post";
import type { StoredReply } from "@/lib/tutor/repo";

function Bubble({ m }: { m: ThreadMessage }) {
  const tutor = m.role === "tutor";
  return (
    <li className={`flex ${tutor ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-base leading-relaxed ${tutor ? "bg-white" : "bg-accent text-white"}`}>
        <span className="sr-only">{tutor ? "Cô: " : "Em: "}</span>
        {lines(m.text).map((runs, i) => (
          <p key={i} className="min-h-[1em]">
            {runs.map((r, j) => (r.bold ? <b key={j}>{r.text}</b> : <span key={j}>{r.text}</span>))}
          </p>
        ))}
      </div>
    </li>
  );
}

export function Chat({ initial }: { initial: Thread }) {
  const [messages, setMessages] = useState(initial.messages);
  const [status, setStatus] = useState(initial.status);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<{ id: string; text: string } | null>(null);
  const open = status === "in_progress";
  const last = messages.at(-1);
  const buttons = open && !busy && last?.role === "tutor" ? last.buttons : [];

  async function send(value: string) {
    const t = value.trim();
    if (!t || busy || !open) return;
    if (!attempt.current || attempt.current.text !== t) attempt.current = { id: newClientMsgId(), text: t };
    const id = attempt.current.id;
    setBusy(true);
    setError(null);
    setMessages((ms) => (ms.some((m) => m.id === id) ? ms : [...ms, { id, role: "child", text: t, buttons: [] }]));
    const r = await postWithRetry<StoredReply>("/api/turn", { problemId: initial.problemId, clientMsgId: id, text: t });
    if (r.ok) {
      setMessages((ms) => [...ms, { id: `${id}-reply`, role: "tutor", text: r.data.message, buttons: r.data.buttons }]);
      setStatus(r.data.status);
      setText("");
      attempt.current = null;
    } else {
      if (r.status === 503) {
        attempt.current = null;
        setMessages((ms) => ms.filter((m) => m.id !== id)); // the server dropped it
      }
      if (r.status === 409 && r.message.startsWith("Bài này đã đóng")) setStatus("timed_out");
      setError(r.message);
    }
    setBusy(false);
  }

  return (
    <>
      <ol aria-live="polite" className="flex flex-col gap-3">
        {messages.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
        {busy && (
          <li className="text-sm text-ink/60" aria-label="Cô đang trả lời">
            Cô đang nghĩ…
          </li>
        )}
      </ol>

      {!open && (
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-4">
          <p className="font-semibold">
            {status === "timed_out" ? "Bài này đã đủ 20 lượt. Em ghi lại chỗ đã làm được và để dành hỏi thầy nhé." : "Bài này đã đóng."}
          </p>
          <Link href="/" className="btn self-start bg-accent text-white no-underline">Hỏi bài khác</Link>
        </div>
      )}

      {open && (
        <form
          className="fixed inset-x-0 bottom-0 border-t border-ink/10 bg-bg/95 p-3 backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            {buttons.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {buttons.map((b) => (
                  <button key={b} type="button" onClick={() => void send(b)} className="btn border-[1.5px] border-accent bg-white text-accent">
                    {b}
                  </button>
                ))}
              </div>
            )}
            {error && <p role="alert" className="text-sm font-semibold text-[#A33A2B]">{error}</p>}
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col">
                <span className="sr-only">Em trả lời</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="Em trả lời cô…"
                  className="rounded-xl border-[1.5px] border-ink/15 bg-white p-3 text-base"
                />
              </label>
              <button type="submit" disabled={busy || !text.trim()} className="btn bg-accent text-white disabled:opacity-50">
                Gửi
              </button>
            </div>
          </div>
        </form>
      )}
    </>
  );
}

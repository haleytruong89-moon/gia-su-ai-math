"use client";

import { useState } from "react";
import { MAX_NOTE_CHARS } from "@/lib/parent/feedbackInput";

type Thumb = "up" | "down";

/** 👍/👎 + note on one tutor turn. A 👎 opens the note; the note is what the tutor learns from (G7b). */
export function FeedbackButtons({ problemId, messageId, initial }: {
  problemId: string; messageId: string; initial: { thumb: Thumb; note: string | null } | null;
}) {
  const [thumb, setThumb] = useState<Thumb | null>(initial?.thumb ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(initial ? { ok: true, text: "Đã lưu góp ý" } : null);
  const [busy, setBusy] = useState(false);

  async function send(t: Thumb, n: string) {
    setBusy(true);
    setState(null);
    try {
      const res = await fetch("/gia-su/api/parent/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId, messageId, thumb: t, note: n }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setState(res.ok ? { ok: true, text: "Đã lưu góp ý" } : { ok: false, text: json.error ?? "Có lỗi, thử lại sau." });
      if (res.ok) setOpen(false);
    } catch {
      setState({ ok: false, text: "Mạng lỗi, thử lại." });
    }
    setBusy(false);
  }

  const pick = (t: Thumb) => {
    setThumb(t);
    setOpen(true);
    if (t === "up" && !note.trim()) void send(t, "");
  };

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-ink/10 pt-2">
      <div className="flex items-center gap-2">
        <button type="button" disabled={busy} onClick={() => pick("up")} aria-pressed={thumb === "up"}
          className={`btn border ${thumb === "up" ? "border-accent bg-accent/10" : "border-ink/15"}`} aria-label="Cô dạy tốt">
          👍
        </button>
        <button type="button" disabled={busy} onClick={() => pick("down")} aria-pressed={thumb === "down"}
          className={`btn border ${thumb === "down" ? "border-accent bg-accent/10" : "border-ink/15"}`} aria-label="Cô nên dạy khác">
          👎
        </button>
        {state && <span className={`text-sm ${state.ok ? "text-accent" : "text-red-700"}`}>{state.text}</span>}
      </div>
      {open && thumb && (
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void send(thumb, note); }}>
          <textarea value={note} maxLength={MAX_NOTE_CHARS} rows={2} onChange={(e) => setNote(e.target.value)}
            placeholder={thumb === "down" ? "Cô nên làm khác thế nào?" : "Giữ cách này vì… (không bắt buộc)"}
            className="rounded-xl border-[1.5px] border-ink/15 bg-white p-3 text-base" />
          <button type="submit" disabled={busy} className="btn self-start bg-accent text-white">Gửi</button>
        </form>
      )}
    </div>
  );
}

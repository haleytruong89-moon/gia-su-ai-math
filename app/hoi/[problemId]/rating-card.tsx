"use client";

import { useState } from "react";
import { postWithRetry } from "@/lib/client/post";
import { FACES } from "@/lib/rules/rating";
import { REASON_LABEL } from "@/lib/report/labels";
import { FLAG_COPY } from "@/lib/copy";
import { RATING_REASONS, type RatingReason } from "@/lib/rules/teachingRules";

type Face = (typeof FACES)[number]["face"];

/** "Hôm nay cô dạy em thế nào?" — one tap saves (US6); reasons are optional; "Bỏ qua" hides it for the session (P2). */
export function RatingCard({ sessionId, onDone }: { sessionId: string; onDone: (how: "rated" | "skipped") => void }) {
  const [face, setFace] = useState<Face | null>(null);
  const [reasons, setReasons] = useState<RatingReason[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(f: Face, rs: RatingReason[], note = "") {
    setBusy(true);
    setError(null);
    const r = await postWithRetry<{ status: string }>("/api/session/rate", { sessionId, face: f, reasons: rs, comment: note.trim() || null });
    setBusy(false);
    if (!r.ok) setError(r.message);
    return r.ok;
  }

  return (
    <section aria-label="Chấm cô" className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-accent/30 bg-white p-4">
      <p className="font-semibold">{face ? "Cảm ơn em! Vì sao vậy? (không bắt buộc)" : "Hôm nay cô dạy em thế nào?"}</p>
      {!face ? (
        <div className="flex flex-wrap gap-2">
          {FACES.map((x) => (
            <button key={x.face} type="button" disabled={busy} aria-label={x.label}
              onClick={async () => { if (await send(x.face, [])) setFace(x.face); }}
              className="btn flex-col border-[1.5px] border-ink/15 bg-white px-4 py-2 text-base">
              <span className="text-3xl" aria-hidden="true">{x.emoji}</span>
              <span className="text-sm">{x.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {RATING_REASONS.map((r) => {
            const on = reasons.includes(r);
            return (
              <button key={r} type="button" aria-pressed={on} disabled={busy}
                onClick={() => setReasons((rs) => (on ? rs.filter((x) => x !== r) : [...rs, r]))}
                className={`btn border-[1.5px] text-sm ${on ? "border-accent bg-accent/10" : "border-ink/15 bg-white"}`}>
                {REASON_LABEL[r]}
              </button>
            );
          })}
          <label className="flex w-full flex-col gap-1 text-sm">
            {FLAG_COPY.ratingComment}
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} disabled={busy}
              placeholder={FLAG_COPY.placeholder} className="rounded-xl border-[1.5px] border-ink/15 p-2 text-base" />
          </label>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {face ? (
          <button type="button" disabled={busy} className="btn bg-accent text-white"
            onClick={async () => { if ((!reasons.length && !comment.trim()) || (await send(face, reasons, comment))) onDone("rated"); }}>
            Xong
          </button>
        ) : (
          <button type="button" disabled={busy} className="btn border-[1.5px] border-ink/20 bg-white" onClick={() => onDone("skipped")}>
            Bỏ qua
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-[#A33A2B]">{error}</p>}
    </section>
  );
}

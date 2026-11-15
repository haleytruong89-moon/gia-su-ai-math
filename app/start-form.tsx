"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { prepareImage } from "@/lib/client/image";
import { deviceGuess, newClientMsgId, postForm, postWithRetry } from "@/lib/client/post";
import { PHOTO_COPY, STUCK_LABELS } from "@/lib/copy";

type Stuck = keyof typeof STUCK_LABELS;

/** `replaces`: the problem a retake replaces (G3 Q3). */
export function StartForm({ replaces = null }: { replaces?: string | null }) {
  const router = useRouter();
  const [stuck, setStuck] = useState<Stuck | null>(null);
  const [statement, setStatement] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  // One id per problem attempt: a resend after a network error reuses it (no second problem).
  const attempt = useRef<{ id: string; text: string; photo: Blob | null } | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    const r = await prepareImage(file);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    setPhoto({ blob: r.blob, previewUrl: r.previewUrl });
  }

  async function send() {
    const text = statement.trim();
    if ((!text && !photo) || busy) return;
    const blob = photo?.blob ?? null;
    if (!attempt.current || attempt.current.text !== text || attempt.current.photo !== blob) attempt.current = { id: newClientMsgId(), text, photo: blob };
    setBusy(true);
    setError(null);
    const fields = { clientMsgId: attempt.current.id, stuckKind: stuck ?? "", statement: text, device: deviceGuess(), replacesProblemId: replaces ?? "" };
    const r = blob
      ? await postForm<{ problemId: string }>("/api/problem/new", fields, blob)
      : await postWithRetry<{ problemId: string }>("/api/problem/new", { ...fields, stuckKind: stuck, replacesProblemId: replaces });
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
      <div className="flex flex-col gap-2">
        <span className="font-semibold">Ảnh đề</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => camera.current?.click()} className="btn bg-accent text-white">{PHOTO_COPY.take}</button>
          <button type="button" onClick={() => gallery.current?.click()} className="btn border-[1.5px] border-ink/15 bg-white">{PHOTO_COPY.pick}</button>
        </div>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" aria-label={PHOTO_COPY.take}
          onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={gallery} type="file" accept="image/*" className="hidden" aria-label={PHOTO_COPY.pick}
          onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
        {photo && (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not an optimizable asset */}
            <img src={photo.previewUrl} alt="Ảnh đề em chọn" className="max-h-60 rounded-xl border border-ink/10" />
            <button type="button" onClick={() => { URL.revokeObjectURL(photo.previewUrl); setPhoto(null); }}
              className="btn border-[1.5px] border-ink/15 bg-white">{PHOTO_COPY.remove}</button>
          </div>
        )}
        <p className="text-xs text-ink/60">{PHOTO_COPY.hint}</p>
      </div>
      <label className="flex flex-col gap-2">
        <span className="font-semibold">{photo ? "Ghi chú cho cô (không bắt buộc, vd: bài 3)" : "Hoặc gõ đề bài"}</span>
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          rows={6}
          maxLength={2000}
          placeholder={photo ? "Em đang làm bài số mấy, kẹt ở đâu…" : "Gõ lại đề bài em đang làm…"}
          className="rounded-xl border-[1.5px] border-ink/15 bg-white p-3 text-base"
        />
      </label>
      <p className="text-xs text-ink/60">Đừng gõ họ tên hay tên trường vào đây.</p>
      {error && <p role="alert" className="text-sm font-semibold text-[#A33A2B]">{error}</p>}
      <button type="submit" disabled={busy || (!statement.trim() && !photo)} className="btn self-start bg-accent text-white disabled:opacity-50">
        {busy ? "Cô đang đọc đề…" : "Gửi"}
      </button>
    </form>
  );
}

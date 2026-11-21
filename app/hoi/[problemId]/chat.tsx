"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import type { Thread, ThreadMessage } from "@/lib/db/supabaseRepo";
import { prepareImage } from "@/lib/client/image";
import { BTN_NOT_UNDERSTAND_PROBLEM, BTN_NOT_UNDERSTOOD, BTN_SAVE, PHOTO_COPY, PHOTO_ONLY_TEXT } from "@/lib/copy";
import { MAX_IMAGES_PER_PROBLEM, MISREAD_HINT_AT, misreadCount } from "@/lib/rules/photo";
import { lines } from "@/lib/markdown";
import { newClientMsgId, postForm, postWithRetry } from "@/lib/client/post";
import type { InputKind } from "@/lib/rules/events";
import type { ProblemStatus, StoredReply } from "@/lib/tutor/repo";
import { shouldShowRating } from "@/lib/rules/rating";
import { RatingCard } from "./rating-card";
import { ReferenceSolution } from "./reference-solution";
import { CardView } from "./card-view";

const CLOSED_TEXT: Partial<Record<ProblemStatus, string>> = {
  timed_out: "Bài này đã đủ 20 lượt. Em ghi lại chỗ đã làm được và để dành hỏi thầy nhé.",
  saved_for_later: "Đã để dành bài này cho thầy xem. Em làm bài khác trước nhé.",
  pending_review: "Bài chứng minh đã gửi để thầy xem.",
  closed_offtopic: "Bài này đã đóng vì mình nói chuyện ngoài bài. Khi nào kẹt bài Toán, em mở bài mới nhé.",
  self_solved: "Em đã tự làm xong bài này. Giỏi lắm!",
};

function Bubble({ m }: { m: ThreadMessage }) {
  const tutor = m.role === "tutor";
  return (
    <li className={`flex ${tutor ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-base leading-relaxed ${tutor ? "bg-white" : "bg-accent text-white"}`}>
        <span className="sr-only">{tutor ? "Cô: " : "Em: "}</span>
        {m.images.map((src) => (
          <a key={src} href={src} target="_blank" rel="noreferrer" className="mb-2 block">
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL / local preview */}
            <img src={src} alt="Ảnh em gửi" className="max-h-60 rounded-xl bg-white" />
          </a>
        ))}
        {lines(m.text).map((runs, i) => (
          <p key={i} className="min-h-[1em]">
            {runs.map((r, j) => (r.bold ? <b key={j}>{r.text}</b> : <span key={j}>{r.text}</span>))}
          </p>
        ))}
        {m.cardRef && <CardView cardRef={m.cardRef} />}
      </div>
    </li>
  );
}

export interface RatingInfo { sessionId: string; sessionStatus: "active" | "ended" | "abandoned"; rated: boolean; earlierEnded: boolean }

const skipKey = (sessionId: string) => `gia-su-rate-skip-${sessionId}`;
const noSubscribe = () => () => {};
function readSkip(sessionId: string | undefined): boolean {
  try {
    return !!sessionId && sessionStorage.getItem(skipKey(sessionId)) !== null;
  } catch {
    return false; // storage blocked: the card may show again
  }
}

export function Chat({ initial, rating }: { initial: Thread; rating: RatingInfo | null }) {
  const [rated, setRated] = useState(rating?.rated ?? true);
  // "Bỏ qua" is remembered for this session on this device (a light convenience, P2).
  const skippedBefore = useSyncExternalStore(noSubscribe, () => readSkip(rating?.sessionId), () => false);
  const [skippedNow, setSkipped] = useState(false);
  const skipped = skippedBefore || skippedNow;
  const [ending, setEnding] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(rating?.sessionStatus === "active");
  const router = useRouter();
  const [messages, setMessages] = useState(initial.messages);
  const [status, setStatus] = useState(initial.status);
  const [confirmed, setConfirmed] = useState(initial.statementConfirmed);
  const [photo, setPhoto] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submit, setSubmit] = useState(false);
  const [askSave, setAskSave] = useState(false);
  const attempt = useRef<{ id: string; text: string } | null>(null);
  const saveId = useRef<string | null>(null);
  const open = status === "in_progress";
  const showRating = !!rating && shouldShowRating({ status, rated, earlierEnded: rating.earlierEnded, skipped, endingSession: ending });
  const leave = () => router.push("/");

  function ratingDone(how: "rated" | "skipped") {
    if (how === "rated") setRated(true);
    else {
      setSkipped(true);
      try {
        if (rating) sessionStorage.setItem(skipKey(rating.sessionId), "1");
      } catch { /* ignore */ }
    }
    if (ending) leave();
  }

  /** "Kết thúc buổi" (§3.1): the server ends the session; the rating card follows if not rated (P2). */
  async function endSession() {
    if (!rating || busy) return;
    setBusy(true);
    const r = await postWithRetry<{ status: string; rated: boolean }>("/api/session/end", { sessionId: rating.sessionId });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setSessionOpen(false);
    if (open) setStatus("timed_out");
    if (r.data.rated || rated || skipped) leave();
    else setEnding(true);
  }
  const last = messages.at(-1);
  const tutorTurn = open && !busy && last?.role === "tutor";
  // "Chưa hiểu", "Em không hiểu đề" and "Để dành hỏi thầy" are in the fixed row below, so not repeated here.
  const buttons = tutorTurn
    ? last.buttons.filter((b) => b !== BTN_NOT_UNDERSTOOD && b !== BTN_SAVE && b !== BTN_NOT_UNDERSTAND_PROBLEM) : [];

  const photoCount = messages.reduce((n, m) => n + m.images.length, 0);
  const canAddPhoto = photoCount < MAX_IMAGES_PER_PROBLEM;
  const showMisread = open && !confirmed && misreadCount(messages) >= MISREAD_HINT_AT;

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

  async function send(value: string, kind: InputKind) {
    const t = value.trim();
    const withPhoto = kind !== "button" ? photo : null; // a button press never carries the photo
    if ((!t && !withPhoto) || busy || !open) return;
    if (!attempt.current || attempt.current.text !== t) attempt.current = { id: newClientMsgId(), text: t };
    const id = attempt.current.id;
    setBusy(true);
    setError(null);
    setAskSave(false);
    const shown = t || PHOTO_ONLY_TEXT;
    setMessages((ms) => (ms.some((m) => m.id === id) ? ms
      : [...ms, { id, role: "child", text: shown, buttons: [], images: withPhoto ? [withPhoto.previewUrl] : [], cardRef: null }]));
    const fields = { problemId: initial.problemId, clientMsgId: id, text: t, kind };
    const r = withPhoto
      ? await postForm<StoredReply>("/api/turn", fields, withPhoto.blob)
      : await postWithRetry<StoredReply>("/api/turn", fields);
    if (r.ok) {
      setMessages((ms) => [...ms, { id: `${id}-reply`, role: "tutor", text: r.data.message, buttons: r.data.buttons, images: [],
        cardRef: r.data.cardRef ?? null }]);
      setStatus(r.data.status);
      setConfirmed(r.data.statementConfirmed);
      if (withPhoto) setPhoto(null); // the preview URL stays in use by the bubble
      if (kind !== "button") setText("");
      if (kind === "submit") setSubmit(false);
      attempt.current = null;
    } else {
      if (r.status === 503 || r.status === 413 || r.status === 415 || (r.status === 409 && !r.message.startsWith("Bài này đã đóng") && !r.message.startsWith("Cô vẫn"))) {
        attempt.current = null;
        setMessages((ms) => ms.filter((m) => m.id !== id)); // the server dropped it (or never stored it)
      }
      if (r.status === 409 && r.message.startsWith("Bài này đã đóng")) setStatus("timed_out");
      setError(r.message);
    }
    setBusy(false);
  }

  /** "Để dành hỏi thầy" (DOMAIN §3.2): the same client id on every retry of this press. */
  async function saveForLater() {
    if (busy || !open) return;
    saveId.current ??= newClientMsgId();
    setBusy(true);
    setError(null);
    const r = await postWithRetry<{ status: ProblemStatus }>("/api/problem/save", { problemId: initial.problemId, clientMsgId: saveId.current });
    if (r.ok) {
      setMessages((ms) => [...ms, { id: saveId.current!, role: "child", text: BTN_SAVE, buttons: [], images: [], cardRef: null }]);
      setStatus("saved_for_later");
    } else {
      if (r.status === 409 && r.message.startsWith("Bài này đã đóng")) setStatus("timed_out");
      setError(r.message);
    }
    setAskSave(false);
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

      {!open && !ending && (
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-4">
          <p className="font-semibold">{CLOSED_TEXT[status] ?? "Bài này đã đóng."}</p>
          {status === "self_solved" && <ReferenceSolution problemId={initial.problemId} />}
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="btn bg-accent text-white no-underline">Hỏi bài khác</Link>
            {sessionOpen && (
              <button type="button" disabled={busy} onClick={() => void endSession()} className="btn border-[1.5px] border-ink/20 bg-white">
                Kết thúc buổi
              </button>
            )}
          </div>
        </div>
      )}

      {showRating && rating && <RatingCard sessionId={rating.sessionId} onDone={ratingDone} />}

      {open && (
        <form
          className="fixed inset-x-0 bottom-0 border-t border-ink/10 bg-bg/95 p-3 backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text, submit ? "submit" : "text");
          }}
        >
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            {buttons.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {buttons.map((b) => (
                  <button key={b} type="button" onClick={() => void send(b, "button")} className="btn border-[1.5px] border-accent bg-white text-accent">
                    {b}
                  </button>
                ))}
              </div>
            )}
            {askSave ? (
              <div role="group" aria-label="Để dành hỏi thầy" className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3">
                <p className="w-full text-base">Để dành bài này cho thầy xem? Bài sẽ đóng lại, em làm bài khác được.</p>
                <button type="button" disabled={busy} onClick={() => void saveForLater()} className="btn bg-accent text-white disabled:opacity-50">
                  Để dành
                </button>
                <button type="button" onClick={() => setAskSave(false)} className="btn border-[1.5px] border-ink/20 bg-white">
                  Thôi, làm tiếp
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tutorTurn && (
                  <button type="button" onClick={() => void send(BTN_NOT_UNDERSTOOD, "button")} className="btn border-[1.5px] border-ink/20 bg-white">
                    {BTN_NOT_UNDERSTOOD}
                  </button>
                )}
                {tutorTurn && (
                  <button type="button" onClick={() => void send(BTN_NOT_UNDERSTAND_PROBLEM, "button")} className="btn border-[1.5px] border-ink/20 bg-white">
                    {BTN_NOT_UNDERSTAND_PROBLEM}
                  </button>
                )}
                <button type="button" disabled={busy} onClick={() => setAskSave(true)} className="btn border-[1.5px] border-ink/20 bg-white disabled:opacity-50">
                  {BTN_SAVE}
                </button>
                {sessionOpen && (
                  <button type="button" disabled={busy} onClick={() => void endSession()} className="btn ml-auto border-[1.5px] border-ink/20 bg-white text-ink/70 disabled:opacity-50">
                    Kết thúc buổi
                  </button>
                )}
              </div>
            )}
            {showMisread && (
              <p className="rounded-xl bg-[#FFF4E0] px-3 py-2 text-sm">
                {PHOTO_COPY.misread} <Link href={`/?thay=${initial.problemId}`} className="font-semibold">{PHOTO_COPY.retake}</Link>
              </p>
            )}
            {!showMisread && !confirmed && initial.hasImages && (
              <Link href={`/?thay=${initial.problemId}`} className="self-start text-sm font-semibold">{PHOTO_COPY.retake}</Link>
            )}
            {photo && (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview */}
                <img src={photo.previewUrl} alt="Ảnh bài làm em chọn" className="h-20 rounded-lg border border-ink/10" />
                <button type="button" onClick={() => { URL.revokeObjectURL(photo.previewUrl); setPhoto(null); }}
                  className="btn border-[1.5px] border-ink/15 bg-white">{PHOTO_COPY.remove}</button>
              </div>
            )}
            {error && <p role="alert" className="text-sm font-semibold text-[#A33A2B]">{error}</p>}
            <div className="flex items-end gap-2">
              <button type="button" aria-label={PHOTO_COPY.work} title={canAddPhoto ? PHOTO_COPY.work : PHOTO_COPY.tooMany}
                disabled={busy || !canAddPhoto} onClick={() => picker.current?.click()}
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-ink/20 bg-white disabled:opacity-50">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
                </svg>
              </button>
              <input ref={picker} type="file" accept="image/*" className="hidden" aria-label={PHOTO_COPY.work}
                onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
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
              <button type="submit" disabled={busy || (!text.trim() && !photo)} className="btn bg-accent text-white disabled:opacity-50">
                {submit ? "Nộp" : "Gửi"}
              </button>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base">
              <input type="checkbox" checked={submit} onChange={(e) => setSubmit(e.target.checked)} className="h-6 w-6 accent-accent" />
              Đây là bài làm cuối của em (nộp bài)
            </label>
          </div>
        </form>
      )}
    </>
  );
}

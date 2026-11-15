"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChildCard } from "@/lib/parent/profiles";
import { MAX_PROFILE_CHARS, type AnswerMode } from "@/lib/profileForm";

const field = "rounded-xl border-[1.5px] border-ink/15 bg-white p-3 text-base";

export function ProfileForm({ childId, current, defaults }: {
  childId: string;
  current: ChildCard["current"];
  defaults: { childCode: string; maxLines: number; answerMode: AnswerMode };
}) {
  const router = useRouter();
  const [code, setCode] = useState(current?.childCode ?? defaults.childCode);
  const [maxLines, setMaxLines] = useState(current?.maxLines ?? defaults.maxLines);
  const [mode, setMode] = useState<AnswerMode>(current?.answerMode ?? defaults.answerMode);
  const [text, setText] = useState(current?.profileText ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function post(body: object, done: string) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/gia-su/api/admin/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setNote(res.ok ? { ok: true, text: done } : { ok: false, text: json.error ?? "Có lỗi, thử lại sau." });
      if (res.ok) router.refresh();
    } catch {
      setNote({ ok: false, text: "Mạng lỗi, thử lại." });
    }
    setBusy(false);
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void post({ childId, childCode: code, maxLines, answerMode: mode, profileText: text }, "Đã lưu phiên bản mới.");
      }}
    >
      <p className="text-sm font-semibold" style={{ color: current ? "#2F6E45" : "#8A5A00" }}>
        {current ? `Đang bật · phiên bản ${current.version} · lưu ${new Date(current.updatedAt).toLocaleDateString("vi-VN")}` : "Đang tắt (chưa có hồ sơ)"}
      </p>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Mã con
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className={`${field} w-28`} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Số dòng tối đa mỗi lượt
          <input type="number" min={2} max={10} value={maxLines} onChange={(e) => setMaxLines(Number(e.target.value))} className={`${field} w-24`} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Kiểu trả lời
          <select value={mode} onChange={(e) => setMode(e.target.value as AnswerMode)} className={field}>
            <option value="buttons_first">Nút là chính</option>
            <option value="mixed">Gõ ngắn + nút</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Hồ sơ (④)
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} maxLength={MAX_PROFILE_CHARS} className={field}
          placeholder="HỒ SƠ HỌC SINH · mã: HS-9A …" />
      </label>
      {note && <p role="status" className={`text-sm font-semibold ${note.ok ? "text-[#2F6E45]" : "text-[#A33A2B]"}`}>{note.text}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="btn bg-accent text-white disabled:opacity-50">Lưu phiên bản mới</button>
        {current && (
          <button type="button" disabled={busy} onClick={() => void post({ childId, action: "pause" }, "Đã tắt cô gia sư cho con.")}
            className="btn border-[1.5px] border-ink/20 bg-white disabled:opacity-50">
            Tắt cho con này
          </button>
        )}
      </div>
    </form>
  );
}

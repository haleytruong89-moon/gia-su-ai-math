"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChildCard } from "@/lib/parent/profiles";
import { MAX_NOTE_CHARS, MAX_PROFILE_CHARS, noteOf, type AnswerMode } from "@/lib/profileForm";

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
  // D33: the one-tap profile keeps only the parents' private note; a profile pasted by hand has none to read back.
  const pasted = current ? noteOf(current.profileText) === null : false;
  const [privateNote, setPrivateNote] = useState(current ? (noteOf(current.profileText) ?? "") : "");
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
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold" style={{ color: current ? "#2F6E45" : "#8A5A00" }}>
        {current ? `Đang bật · mã ${current.childCode} · phiên bản ${current.version} · lưu ${new Date(current.updatedAt).toLocaleDateString("vi-VN")}` : "Đang tắt"}
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Ghi chú riêng về con (không bắt buộc)
        <textarea value={privateNote} onChange={(e) => setPrivateNote(e.target.value)} rows={4} maxLength={MAX_NOTE_CHARS} className={field}
          placeholder="Vd: mục tiêu thi vào 10 Toán 8,5–9; chưa thuộc hằng đẳng thức; bài hình hay không biết bắt đầu." />
        <span className="text-ink/65">Chỉ ghi điều riêng của con (mục tiêu điểm, lỗi con hay mắc, thầy đang ôn gì). Không ghi họ tên, trường. Cách dạy, checklist và lỗi hay gặp chung cô đã có sẵn.</span>
      </label>
      {pasted && <p className="text-sm text-ink/75">Hồ sơ đang dùng là bản dán tay (xem ở mục nâng cao). Bấm &quot;Lưu ghi chú&quot; sẽ thay bằng hồ sơ ngắn mặc định.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void post({ childId, action: "enable", note: privateNote }, current ? "Đã lưu ghi chú." : "Đã bật cô gia sư cho con.")}
          className="btn bg-accent text-white disabled:opacity-50">
          {current ? "Lưu ghi chú" : "Bật cô cho con"}
        </button>
        {current && (
          <button type="button" disabled={busy} onClick={() => void post({ childId, action: "pause" }, "Đã tắt cô gia sư cho con.")}
            className="btn border-[1.5px] border-ink/20 bg-white disabled:opacity-50">
            Tắt cô cho con này
          </button>
        )}
      </div>
      {note && <p role="status" className={`text-sm font-semibold ${note.ok ? "text-[#2F6E45]" : "text-[#A33A2B]"}`}>{note.text}</p>}
      <details className="rounded-xl border border-ink/10 p-3">
        <summary className="cursor-pointer text-sm font-semibold">Sửa hồ sơ đầy đủ (nâng cao)</summary>
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void post({ childId, childCode: code, maxLines, answerMode: mode, profileText: text }, "Đã lưu phiên bản mới.");
          }}
        >
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
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="btn border-[1.5px] border-accent bg-white text-accent disabled:opacity-50">Lưu phiên bản mới</button>
          </div>
        </form>
      </details>
    </div>
  );
}

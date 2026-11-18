"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** §4.5 c "Bật lại Opus" (only when paused) and the money-push test (D23). */
export function CostActions({ paused }: { paused: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function post(path: string, body: object | null, done: string) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/gia-su${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setNote(res.ok ? { ok: true, text: done } : { ok: false, text: json.error ?? "Có lỗi, thử lại sau." });
      if (res.ok) router.refresh();
    } catch {
      setNote({ ok: false, text: "Mạng lỗi, thử lại." });
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {paused && (
          <button type="button" disabled={busy} className="btn bg-accent text-white"
            onClick={() => {
              if (window.confirm("Bố mẹ đã nâng trần trong Console chưa? Nếu chưa, Console vẫn chặn ở 50 USD.")) {
                void post("/api/parent/usage", { action: "resume_strong" }, "Đã bật lại Opus cho tháng này.");
              }
            }}>
            Bật lại Opus
          </button>
        )}
        <button type="button" disabled={busy} className="btn border border-ink/15" onClick={() => void post("/api/admin/notify-test", null, "Đã gửi thử — xem iPhone.")}>
          Gửi thử thông báo tiền
        </button>
      </div>
      {note && <p className={`text-sm ${note.ok ? "text-accent" : "text-red-700"}`}>{note.text}</p>}
    </div>
  );
}

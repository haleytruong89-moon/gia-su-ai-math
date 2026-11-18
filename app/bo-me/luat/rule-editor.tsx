"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RULE_MAX_CHARS } from "@/lib/rules/teachingRules";

const field = "rounded-xl border-[1.5px] border-ink/15 bg-white p-3 text-base";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(body: object): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/gia-su/api/parent/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(json.error ?? "Có lỗi, thử lại sau.");
      else router.refresh();
      setBusy(false);
      return res.ok;
    } catch {
      setError("Mạng lỗi, thử lại.");
      setBusy(false);
      return false;
    }
  }
  return { busy, error, run };
}

export function ProposedRule({ id, text, source, reviewHref }: { id: string; text: string; source: string; reviewHref: string | null }) {
  const [value, setValue] = useState(text);
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[#FFF4E0] p-3">
      <p className="text-xs text-ink/70">
        {source}
        {reviewHref && (
          <>
            {" · "}
            <a href={reviewHref} className="text-accent underline">xem lượt dạy</a>
          </>
        )}
      </p>
      <textarea aria-label="Nội dung luật" value={value} maxLength={RULE_MAX_CHARS} rows={2} onChange={(e) => setValue(e.target.value)} className={field} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => run({ action: "approve", ruleId: id, text: value })} className="btn bg-accent text-white">Duyệt</button>
        <button type="button" disabled={busy} onClick={() => run({ action: "reject", ruleId: id })} className="btn border border-ink/15">Bỏ</button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function ActiveRule({ id, text, version, source, approvedAt }: { id: string; text: string; version: number; source: string; approvedAt: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-ink/10 p-3">
      {editing ? (
        <textarea aria-label="Sửa luật" value={value} maxLength={RULE_MAX_CHARS} rows={2} onChange={(e) => setValue(e.target.value)} className={field} />
      ) : (
        <p>{text}</p>
      )}
      <p className="text-xs text-ink/60">
        Phiên bản {version}
        {approvedAt ? ` · duyệt ${approvedAt}` : ""} · {source}
      </p>
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <button type="button" disabled={busy} className="btn bg-accent text-white"
              onClick={async () => { if (await run({ action: "edit", ruleId: id, text: value })) setEditing(false); }}>Lưu</button>
            <button type="button" disabled={busy} className="btn border border-ink/15" onClick={() => { setValue(text); setEditing(false); }}>Thôi</button>
          </>
        ) : (
          <>
            <button type="button" disabled={busy} className="btn border border-ink/15" onClick={() => setEditing(true)}>Sửa</button>
            <button type="button" disabled={busy} className="btn border border-ink/15" onClick={() => run({ action: "retire", ruleId: id })}>Tắt</button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function NewRule({ childId }: { childId: string }) {
  const [value, setValue] = useState("");
  const { busy, error, run } = useAction();
  return (
    <form className="flex flex-col gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "manual", childId, text: value })) setValue(""); }}>
      <label className="text-sm font-semibold" htmlFor={`new-rule-${childId}`}>Viết luật mới</label>
      <textarea id={`new-rule-${childId}`} value={value} maxLength={RULE_MAX_CHARS} rows={2} onChange={(e) => setValue(e.target.value)}
        placeholder="Vd: Khi con làm đúng, khen ngắn một câu rồi giao bước tiếp." className={field} />
      <button type="submit" disabled={busy || !value.trim()} className="btn self-start bg-accent text-white">Thêm luật</button>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}

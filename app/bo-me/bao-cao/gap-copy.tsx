"use client";
// "Sao chép yêu cầu" for one missing card (G6b, C5): the parents paste it into a chat with Claude. No push.
import { useState } from "react";

export function GapCopy({ request }: { request: string }) {
  const [done, setDone] = useState<"ok" | "fail" | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(request);
      setDone("ok");
    } catch {
      setDone("fail");
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void copy()} className="btn border-[1.5px] border-accent bg-white text-accent">Sao chép yêu cầu</button>
      {done === "ok" && <span role="status" className="text-sm">Đã chép — dán vào chat với Claude.</span>}
      {done === "fail" && <span role="status" className="text-sm">Máy chưa cho chép. Bố mẹ giữ chữ bên dưới để chép tay.</span>}
      {done === "fail" && <pre className="w-full whitespace-pre-wrap rounded-lg bg-bg p-2 text-xs">{request}</pre>}
    </div>
  );
}

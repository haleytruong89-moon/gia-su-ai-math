// lib/tutor/fakeClient.ts — canned replies for e2e (no API, no cost). Refused on Vercel.
import type { ModelClient } from "@/lib/tutor/turn";
import fewshot from "@/tests/fixtures/fewshot.json";

export const fakeAllowed = (env: NodeJS.ProcessEnv) => env.TUTOR_FAKE_MODEL === "1" && !env.VERCEL;

export function fakeClient(): ModelClient {
  return {
    async create(req) {
      const r = req as { system?: unknown; messages: { content: unknown }[] };
      const sys = typeof r.system === "string" ? r.system : JSON.stringify(r.system ?? "");
      const isGuard = sys.includes("Em là bộ kiểm tra");
      const isClassify = sys.includes("Em là bộ phân loại");
      const isRuleDraft = sys.includes("LUẬT DẠY");
      const first = r.messages.length <= 1;
      const text = isGuard ? JSON.stringify({ pass: true, ly_do: [] })
        : isClassify ? JSON.stringify({ ku_code: null, exam_slot: null, geometry_proof: false })
        : isRuleDraft ? JSON.stringify({ rule: "Trả lời ngắn hơn, mỗi lượt một ý.", skip: false })
        : JSON.stringify((fewshot as object[])[first ? 0 : 1]);
      return { content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 20 } };
    },
  };
}

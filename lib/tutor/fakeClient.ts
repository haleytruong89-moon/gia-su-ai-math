// lib/tutor/fakeClient.ts — canned replies for e2e (no API, no cost). Refused on Vercel.
import { guardVerdictJson } from "@/lib/tutor/guard";
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
      const isReference = sys.includes("LỜI GIẢI THAM KHẢO");
      const first = r.messages.length <= 1;
      const last = JSON.stringify(r.messages.at(-1)?.content ?? "");
      // G6 e2e: "… là gì" in the child's message → the tutor names the approved card of the grade.
      const asksWhat = last.includes("[EM]") && /là gì/.test(last.split("[EM]").at(-1) ?? "");
      const grade6 = last.includes("lop: 6");
      const text = isGuard ? guardVerdictJson()
        : isClassify ? JSON.stringify({ ku_code: null, exam_slot: null, geometry_proof: false })
        : isRuleDraft ? JSON.stringify({ rule: "Trả lời ngắn hơn, mỗi lượt một ý.", skip: false })
        : isReference ? JSON.stringify({ steps: ["Bước mẫu (model giả)"], final_answer: "x = 4", final_expr: null, final_values: [{ name: "x", value: "4" }] })
        : asksWhat ? JSON.stringify({ ...(fewshot as object[])[1], danh_gia_luot_em: "khong_ap_dung", message: "Cô giảng em phần này nhé:",
          the_hien: grade6 ? "T6.12" : "T9.9" })
        : JSON.stringify((fewshot as object[])[first ? 0 : 1]);
      return { content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 20 } };
    },
  };
}

// lib/tutor/schema.ts
import { z } from "zod";
import { CARD_CODE } from "@/lib/knowledge/cardCodes";

export const tutorOutput = z.object({
  message: z.string().min(1).max(1500),
  buttons: z.array(z.string().min(1).max(40)).max(4),
  de_da_xac_nhan: z.boolean(),
  ku_code_de_xuat: z.string().regex(/^(T6|T9|N7|N8|TH)\.[0-9]{1,2}$/).nullable(),
  goc_loi_du_doan: z.enum(["read", "concept", "strategy", "calc", "careful", "unknown"]).nullable(),
  goc_loi_da_kiem_tra: z.boolean(),
  prereq_gap: z.string().regex(/^(N7|N8|TH|T6|T9)\.[0-9]{1,2}$/).nullable(),
  danh_gia_luot_em: z.enum(["dung", "sai", "khong_biet", "xin_dap_an", "ngoai_le", "khong_ap_dung"]),
  u_level_hien_tai: z.enum(["U0", "U1", "U2", "U3"]),
  ky_thuat: z.enum(["phan_tich_nguoc", "hop_cong_cu", "doc_hinh", "ve_hinh", "dung_cau_truoc", "kiem_tra_hop_ly", "day_bu_nen", "tu_giai_thich", "thuong",
    // D37: the opening lesson — the ways to solve this type (cac_cach) and a worked example (bai_mau).
    "cac_cach", "bai_mau"]),
  checklist_da_hoi: z.array(z.number().int().min(1).max(10)),
  ket_qua_bai: z.enum(["in_progress", "self_solved", "pending_review", "saved_for_later"]),
  flags: z.array(z.enum(["geometry_proof", "tutor_unsure", "off_topic", "injection_attempt"])),
  /** G6: the approved card to show (code from MỤC LỤC THẺ); the app shows it verbatim. */
  the_hien: z.string().regex(CARD_CODE).nullable().optional(),
  /** G6 (C5): no card fits where the child is stuck → a short description of the missing card. */
  the_thieu: z.string().max(80).nullable().optional(),
}).strict();
export type TutorOutput = z.infer<typeof tutorOutput>;

const KU = /^(T6|T9|N7|N8|TH)\.[0-9]{1,2}$/;

/** Size limits the API no longer enforces (see apiSafeSchema): fix what can be fixed without losing the reply. */
function normalize(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = { ...(raw as Record<string, unknown>) };
  if (Array.isArray(o.buttons))
    o.buttons = o.buttons.filter((b): b is string => typeof b === "string" && b.trim().length > 0 && b.length <= 40).slice(0, 4);
  // A malformed knowledge code is not worth losing the reply over: treat it as unknown.
  for (const k of ["ku_code_de_xuat", "prereq_gap"]) if (typeof o[k] === "string" && !KU.test(o[k] as string)) o[k] = null;
  if (typeof o.the_hien === "string" && !CARD_CODE.test(o.the_hien)) o.the_hien = null;
  if (typeof o.the_thieu === "string") o.the_thieu = o.the_thieu.trim().slice(0, 80) || null;
  if (Array.isArray(o.checklist_da_hoi)) o.checklist_da_hoi = o.checklist_da_hoi.filter((n) => Number.isInteger(n) && n >= 1 && n <= 10);
  return o;
}

export function parseTutorOutput(text: string): { ok: true; value: TutorOutput } | { ok: false; error: string } {
  const t = text.trim();
  if (!t.startsWith("{") || !t.endsWith("}")) return { ok: false, error: "not_json_object" };
  try {
    const r = tutorOutput.safeParse(normalize(JSON.parse(t)));
    return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error.issues[0]?.message ?? "invalid" };
  } catch {
    return { ok: false, error: "bad_json" };
  }
}

// Structured outputs reject size/range keywords (HTTP 400 "For 'array' type, …", G0 run 1, 15/11/2026; the
// docs list minimum/maximum and minLength/maxLength as unsupported). Like the SDK helpers, drop them from the
// schema sent to the API and note them in `description`; zod still checks them in parseTutorOutput.
const DROP = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength", "maxItems", "pattern"];

export function apiSafeSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(apiSafeSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  const notes: string[] = [];
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === "$schema") continue;
    if (DROP.includes(k) || (k === "minItems" && typeof v === "number" && v > 1)) {
      notes.push(`${k}: ${typeof v === "string" ? JSON.stringify(v) : String(v)}`);
      continue;
    }
    out[k] = apiSafeSchema(v);
  }
  if (notes.length) out.description = [out.description, `{${notes.join(", ")}}`].filter(Boolean).join(" ");
  return out;
}

// zod 4: z.toJSONSchema → plain JSON Schema → API-safe, for output_config.format.schema
export const tutorOutputJsonSchema = apiSafeSchema(z.toJSONSchema(tutorOutput, { target: "draft-2020-12" })) as
  Record<string, unknown> & { additionalProperties: false };

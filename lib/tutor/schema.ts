// lib/tutor/schema.ts
import { z } from "zod";

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
  ky_thuat: z.enum(["phan_tich_nguoc", "hop_cong_cu", "doc_hinh", "dung_cau_truoc", "kiem_tra_hop_ly", "day_bu_nen", "tu_giai_thich", "thuong"]),
  checklist_da_hoi: z.array(z.number().int().min(1).max(10)),
  ket_qua_bai: z.enum(["in_progress", "self_solved", "pending_review", "saved_for_later"]),
  flags: z.array(z.enum(["geometry_proof", "tutor_unsure", "off_topic", "injection_attempt"])),
}).strict();
export type TutorOutput = z.infer<typeof tutorOutput>;

export function parseTutorOutput(text: string): { ok: true; value: TutorOutput } | { ok: false; error: string } {
  const t = text.trim();
  if (!t.startsWith("{") || !t.endsWith("}")) return { ok: false, error: "not_json_object" };
  try {
    const r = tutorOutput.safeParse(JSON.parse(t));
    return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error.issues[0]?.message ?? "invalid" };
  } catch {
    return { ok: false, error: "bad_json" };
  }
}

// zod 4: z.toJSONSchema → plain JSON Schema for output_config.format.schema
export const tutorOutputJsonSchema = z.toJSONSchema(tutorOutput, { target: "draft-2020-12" }) as
  Record<string, unknown> & { additionalProperties: false };

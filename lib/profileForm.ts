// lib/profileForm.ts — pure checks for the parent's teaching-profile form (/gia-su/bo-me).
import { z } from "zod";

export type AnswerMode = "buttons_first" | "mixed";
export interface ProfileInput { childId: string; childCode: string; maxLines: number; answerMode: AnswerMode; profileText: string }

/** DOMAIN §1: grade 9 → 6 lines, typed answers + buttons; grade 6 → 4 lines, buttons first. */
export function profileDefaults(grade: 6 | 9): { maxLines: number; answerMode: AnswerMode } {
  return grade === 9 ? { maxLines: 6, answerMode: "mixed" } : { maxLines: 4, answerMode: "buttons_first" };
}

export const MAX_PROFILE_CHARS = 4000;

const form = z.object({
  childId: z.string().uuid(),
  childCode: z.string().trim(),
  maxLines: z.coerce.number().int().optional(),
  answerMode: z.enum(["buttons_first", "mixed"]).optional(),
  profileText: z.string(),
});

export function parseProfileForm(raw: unknown, grade: number): { ok: true; value: ProfileInput } | { ok: false; error: string } {
  if (grade !== 6 && grade !== 9) return { ok: false, error: "Gia sư v1 chỉ dành cho lớp 6 và lớp 9." };
  const r = form.safeParse(raw);
  if (!r.success) return { ok: false, error: "Thiếu thông tin." };
  const v = r.data;
  // Same rule as the DB check on teaching_profiles.child_code.
  if (!/^HS-[0-9]{1,2}[A-Z]$/.test(v.childCode)) return { ok: false, error: "Chỉ dùng mã dạng HS-9A, không dùng tên thật." };
  const d = profileDefaults(grade);
  const maxLines = v.maxLines ?? d.maxLines;
  if (maxLines < 2 || maxLines > 10) return { ok: false, error: "Số dòng tối đa phải từ 2 đến 10." };
  const text = v.profileText.trim();
  if (!text) return { ok: false, error: "Hồ sơ đang trống." };
  if (text.length > MAX_PROFILE_CHARS) return { ok: false, error: `Hồ sơ dài quá ${MAX_PROFILE_CHARS} ký tự.` };
  return { ok: true, value: { childId: v.childId, childCode: v.childCode, maxLines, answerMode: v.answerMode ?? d.answerMode, profileText: text } };
}

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

// ---------- D33: one-tap enable ----------
// The general teaching (method, checklists, common mistakes, toolbox) lives in the prompt and the knowledge base;
// the profile only says who the child is (code, grade, reply length) plus the parents' private note.

const NOTE_MARK = "Ghi chú riêng của bố mẹ: ";
const NO_NOTE = "(chưa có)";
export const MAX_NOTE_CHARS = 1000;

const STYLE: Record<6 | 9, string> = { 9: "gõ ngắn + nút", 6: "NÚT LÀ CHÍNH, gõ ít · câu ngắn, từ dễ" };

export function defaultProfileText(grade: 6 | 9, childCode: string, note: string): string {
  const n = note.trim();
  return [`HỒ SƠ HỌC SINH · mã: ${childCode}`, `Lớp ${grade} · SGK Kết nối tri thức`,
    `max_lines: ${profileDefaults(grade).maxLines} · kiểu trả lời: ${STYLE[grade]}`, `${NOTE_MARK}${n || NO_NOTE}`].join("\n");
}

/** The parents' note of a profile made by the one-tap button; null for a profile pasted by hand. */
export function noteOf(profileText: string): string | null {
  const i = profileText.indexOf(`\n${NOTE_MARK}`);
  if (i < 0) return null;
  const n = profileText.slice(i + NOTE_MARK.length + 1);
  return n === NO_NOTE ? "" : n;
}

export function parseEnableForm(raw: unknown): { ok: true; value: { childId: string; note: string } } | { ok: false; error: string } {
  const r = z.object({ childId: z.string().uuid(), note: z.string().optional() }).safeParse(raw);
  if (!r.success) return { ok: false, error: "Thiếu thông tin." };
  const note = (r.data.note ?? "").trim();
  if (note.length > MAX_NOTE_CHARS) return { ok: false, error: `Ghi chú dài quá ${MAX_NOTE_CHARS} ký tự.` };
  return { ok: true, value: { childId: r.data.childId, note } };
}

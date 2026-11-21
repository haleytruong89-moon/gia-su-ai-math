// lib/report/labels.ts — Vietnamese words of the parents' report. Pure.
import { addDays, dateVn } from "@/lib/time";
import type { ProblemStatus } from "@/lib/tutor/repo";

export const STATUS_LABEL: Record<ProblemStatus, string> = {
  in_progress: "Đang làm",
  self_solved: "Tự làm xong",
  pending_review: "Chờ thầy xem",
  saved_for_later: "Để dành hỏi thầy",
  closed_offtopic: "Đóng (ngoài bài)",
  abandoned: "Bỏ dở",
  timed_out: "Hết lượt / hết giờ",
};

export const FACE_LABEL: Record<"easy" | "ok" | "hard", string> = { easy: "🙂 Dễ hiểu", ok: "😐 Bình thường", hard: "😕 Khó hiểu" };

export const REASON_LABEL: Record<string, string> = {
  too_long: "Cô nói dài quá",
  hard_words: "Có từ khó hiểu",
  answer_too_early: "Cô nói trước khi em thử",
  too_many_questions: "Cô hỏi nhiều quá",
  good_example: "Ví dụ hay",
  clear: "Dễ hiểu",
};

/** The report day from ?ngay=YYYY-MM-DD; a missing, malformed or future day → today (VN). */
export function reportDate(param: string | string[] | undefined, now: Date): string {
  const today = dateVn(now);
  const v = Array.isArray(param) ? param[0] : param;
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) return today;
  if (addDays(v, 0) !== v) return today; // 2026-02-31 and the like
  return v > today ? today : v;
}

/** "Thứ Tư 18/11" for a YYYY-MM-DD day. */
export function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const name = wd === 0 ? "Chủ nhật" : `Thứ ${["", "Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy"][wd]}`;
  return `${name} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

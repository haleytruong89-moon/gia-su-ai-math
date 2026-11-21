// lib/report/cardGaps.ts — "Thẻ cần bổ sung" in the evening report (G6b, C5): what the tutor met without an approved
// card, at least twice within the last 7 VN days. Pure; the events are read in lib/report/load.ts. No push (C5).
import { addDays, dateVn } from "@/lib/time";

export interface GapEvent {
  at: string; // ISO time
  grade: 6 | 9;
  childId: string;
  problemId: string;
  /** the_thieu: the tutor named a gap · no_card: a code without a card · unknown_ku: no lesson found · het_cach: 2 ways were not enough */
  kind: "the_thieu" | "no_card" | "unknown_ku" | "het_cach";
  key: string;
  statement: string | null;
}
export interface CardGap { key: string; kind: GapEvent["kind"]; grade: 6 | 9; count: number; days: string[]; childIds: string[];
  example: string | null; request: string }

export const GAP_MIN = 2;
export const GAP_DAYS = 7;

/** Same wording → same gap: lowercase, NFC, spaces collapsed, no end punctuation. */
export const gapKey = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/u, "").trim();

const ddmm = (vn: string) => `${vn.slice(8, 10)}/${vn.slice(5, 7)}`;
const KIND_TEXT: Record<GapEvent["kind"], string> = {
  the_thieu: "cô gặp chỗ con vướng mà chưa có thẻ",
  no_card: "cô muốn dùng thẻ nhưng thẻ chưa có",
  unknown_ku: "chưa xác định được bài học SGK",
  het_cach: "đã giảng 2 cách mà con vẫn chưa hiểu",
};

function request(g: Omit<CardGap, "request">): string {
  const what = g.kind === "het_cach" ? `thêm cách giảng thứ 3 (hoặc sửa thẻ) cho ${g.key.replace(/^het_cach:/, "")}`
    : g.kind === "no_card" ? `thẻ ${g.key}` : `"${g.key}"`;
  return [
    `Nhờ soạn thẻ gia sư Toán lớp ${g.grade}: ${what}.`,
    `Lý do: ${KIND_TEXT[g.kind]} — ${g.count} lần trong ${GAP_DAYS} ngày (${g.days.join(", ")}).`,
    ...(g.example ? [`Ví dụ đề (đã bỏ tên): ${g.example}`] : []),
    "Theo định dạng knowledge/src/cards: 2 cách, ví dụ dùng số khác đề thật, có \"vì sao\", 1–3 câu ôn.",
  ].join("\n");
}

/** C5: the same gap ≥ 2 times within 7 days (VN days, today included), most frequent first. */
export function cardGaps(events: readonly GapEvent[], now: Date, hasCard: (code: string) => boolean): CardGap[] {
  const today = dateVn(now);
  const from = addDays(today, -(GAP_DAYS - 1));
  const groups = new Map<string, GapEvent[]>();
  for (const e of events) {
    const day = dateVn(new Date(e.at));
    if (day < from || day > today) continue;
    if (e.kind === "no_card" && hasCard(e.key)) continue;
    const k = `${e.grade}|${e.kind}|${e.kind === "the_thieu" ? gapKey(e.key) : e.key}`;
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const out: CardGap[] = [];
  for (const list of groups.values()) {
    if (list.length < GAP_MIN) continue;
    const sorted = [...list].sort((a, b) => a.at.localeCompare(b.at));
    const first = sorted[0]!;
    const g = {
      key: first.kind === "the_thieu" ? first.key.trim() : first.key, kind: first.kind, grade: first.grade, count: list.length,
      days: [...new Set(sorted.map((e) => ddmm(dateVn(new Date(e.at)))))], childIds: [...new Set(sorted.map((e) => e.childId))],
      example: sorted.at(-1)!.statement?.slice(0, 300) ?? null,
    };
    out.push({ ...g, request: request(g) });
  }
  return out.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

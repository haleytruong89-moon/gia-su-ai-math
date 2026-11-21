// lib/report/flags.ts — the ⚠️ flags of the parents' evening report (DOMAIN §4.7). Pure, no I/O.
// The order of the returned flags is the parents' priority order (X1, 18/11/2026): the Launcher
// shows only the first two as "cần chú ý" lines (lib/report/attention.ts).
import type { ProblemStatus } from "@/lib/tutor/repo";

export type FlagKind =
  | "cas_loi" | "y_chan" | "nan_bo_do" | "con_cham_kho" | "goi_y_nhieu" | "cho_thay" | "lo_hong_nen" | "bai_hinh" | "viet_lai_nhieu";

export interface ProblemFacts {
  id: string;
  status: ProblemStatus;
  hintLevelMax: number;
  nanJumps: number;
  uLevel: 0 | 1 | 2 | 3;
  kuCode: string | null;
  examSlot: string | null;
  prereqGaps: string[];
  geometryProof: boolean;
  /** Answers of this problem the checker had to have rewritten. */
  rewrittenCount: number;
  /** G7c: the reference solution's answer did not match the child's checked answer (X5). */
  referenceMismatch: boolean;
}

export interface DayFacts { problems: ProblemFacts[]; sessionsAbandoned: number; ratingsHard: number; casErrors: number }
export interface Flag { kind: FlagKind; text: string; problemIds: string[] }
export interface MonthFacts { costUsd: number; mode: "normal" | "economy" }

/** Hà Nội grade-10 exam items that decide 9+ (DOMAIN §4.7 v0.4): 2c, 3c, 4b ý 2, 4c, 5. */
export function isBlockedSlot(slot: string | null): boolean {
  if (!slot) return false;
  return ["HN10-2c", "HN10-3c", "HN10-4b-y2", "HN10-4c"].includes(slot) || /^HN10-5([a-c])?(-y[12])?$/.test(slot);
}

const ids = (ps: ProblemFacts[]) => ps.map((x) => x.id);
const vnNumber = (n: number) => n.toFixed(1).replace(/\.0$/, "").replace(".", ",");

export function dayFlags(day: DayFacts, kuTitle: (code: string) => string | null): Flag[] {
  const ps = day.problems;
  const out: Flag[] = [];

  if (day.casErrors >= 2) out.push({ kind: "cas_loi", text: `Máy tính đại số lỗi ${day.casErrors} lần`, problemIds: [] });

  const blocked = ps.filter((x) => isBlockedSlot(x.examSlot) && x.uLevel <= 1);
  if (blocked.length) {
    out.push({ kind: "y_chan", text: `Ý chặn dừng ở U0–U1: ${blocked.map((x) => `${x.examSlot} (U${x.uLevel})`).join(", ")}`, problemIds: ids(blocked) });
  }

  const abandoned = ps.filter((x) => x.status === "abandoned").length;
  const nan = ps.reduce((n, x) => n + x.nanJumps, 0);
  if (abandoned || nan || day.sessionsAbandoned) {
    const parts = [
      ...(abandoned ? [`${abandoned} bài bỏ dở`] : []),
      ...(day.sessionsAbandoned ? [`${day.sessionsAbandoned} buổi bỏ dở`] : []),
      ...(nan ? [`nản ${nan} lần`] : []),
    ];
    out.push({ kind: "nan_bo_do", text: `Nản / bỏ dở: ${parts.join(", ")}`, problemIds: ids(ps.filter((x) => x.status === "abandoned" || x.nanJumps > 0)) });
  }

  if (day.ratingsHard > 0) out.push({ kind: "con_cham_kho", text: "Con chấm cô: khó hiểu", problemIds: [] });

  const h4 = ps.filter((x) => x.hintLevelMax >= 4);
  if (h4.length >= 2) {
    const h4Nan = h4.reduce((n, x) => n + x.nanJumps, 0);
    out.push({ kind: "goi_y_nhieu", text: `Gợi ý nhiều: ${h4.length} bài lên H4 (${h4Nan} lần do nản)`, problemIds: ids(h4) });
  }

  const review = ps.filter((x) => x.status === "pending_review");
  if (review.length) out.push({ kind: "cho_thay", text: `Chờ thầy xem: ${review.length} bài`, problemIds: ids(review) });

  const gaps = [...new Set(ps.flatMap((x) => x.prereqGaps))];
  if (gaps.length) {
    const named = gaps.map((c) => {
      const t = kuTitle(c);
      return t ? `${c} — ${t}` : c;
    });
    out.push({ kind: "lo_hong_nen", text: `Lỗ hổng nền: ${named.join("; ")}`, problemIds: ids(ps.filter((x) => x.prereqGaps.length > 0)) });
  }

  const proofs = ps.filter((x) => x.geometryProof);
  if (proofs.length) out.push({ kind: "bai_hinh", text: `Bài hình chứng minh: ${proofs.length} bài (để thầy xem)`, problemIds: ids(proofs) });

  const rewritten = ps.filter((x) => x.rewrittenCount >= 2);
  if (rewritten.length) out.push({ kind: "viet_lai_nhieu", text: `Cô phải viết lại nhiều ở ${rewritten.length} bài`, problemIds: ids(rewritten) });

  return out;
}

/** The family's money line (§4.5 a: > 80% of the 50 USD cap, or the strong model paused — D29). */
export function costFlag(m: MonthFacts): string | null {
  if (m.mode === "economy") return `Chi phí tháng: ${vnNumber(m.costUsd)} / 50 USD · đang tạm ngừng Opus`;
  return m.costUsd > 40 ? `Chi phí tháng: ${vnNumber(m.costUsd)} / 50 USD (> 80%)` : null;
}

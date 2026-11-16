// Layer ⑤ of the prompt (the knowledge card of the problem), the lookup tool's text and the classifier's index.
import { KNOWLEDGE, codeFitsGrade, section, unit } from "./load";
import type { KnowledgeUnit } from "./schema";

export const CARD_MAX = 3500;
export const LOOKUP_MAX = 2400;

export function checklistFor(code: string | null, grade: 6 | 9): { n: number; text: string }[] {
  const u = code && codeFitsGrade(code, grade) ? unit(code) : null;
  const ns = u && u.level === "bai" ? u.checklist : KNOWLEDGE.defaults[grade === 6 ? "g6" : "g9"];
  return ns.map((n) => ({ n, text: KNOWLEDGE.checklist.find((c) => c.grade === grade && c.n === n)?.text ?? "" }));
}

const named = (code: string) => `${code} ${unit(code)?.title ?? ""}`.trim();
const errorsLine = (u: KnowledgeUnit) => u.errors.map((e) => (e.root ? `[${e.root}] ${e.text}` : e.text)).join(" · ");
const checklistBlock = (items: { n: number; text: string }[]) =>
  `Checklist trước khi chốt (hỏi theo dạng bài, ghi số vào checklist_da_hoi): ${items.map((i) => `${i.n}. ${i.text}`).join(" · ")}`;

function unknownCard(grade: 6 | 9): string {
  return [
    "[KIẾN THỨC — chưa xác định] App chưa biết bài này thuộc bài SGK nào.",
    `Tra kiến thức bằng công cụ lookup (vd lookup("${grade === 9 ? "T9.9" : "T6.12"}"), lookup("${grade === 9 ? "N8.02" : "TH.05"}")).`,
    `Khi xác nhận đề, điền ku_code_de_xuat (mã bài SGK lớp ${grade}).`,
    checklistBlock(checklistFor(null, grade)),
  ].join("\n");
}

/** Layer ⑤. A null, unknown or other-grade code gives the "unknown" card. Never longer than CARD_MAX. */
export function knowledgeCard(code: string | null, grade: 6 | 9): string {
  const u = code && codeFitsGrade(code, grade) ? unit(code) : null;
  if (!u || u.level !== "bai") return unknownCard(grade);
  const head = [
    `[KIẾN THỨC — bài này] ${u.code} · ${u.title} (${u.term}, ${u.chapter})`,
    `Cốt lõi: ${u.core}`,
    `Dạng bài: ${u.problemTypes}`,
    `Lỗi hay gặp: ${errorsLine(u)}`,
    u.prereqs.length ? `Kiến thức nền: ${u.prereqs.map(named).join(" · ")}` : "",
    u.prereqs.length ? "  → Em vướng đúng phần nền: dạy bù ≤ 2 lượt (ky_thuat day_bu_nen, prereq_gap = mã nền), rồi quay lại bài." : "",
    checklistBlock(checklistFor(u.code, grade)),
    u.toolbox.length ? `Hộp công cụ (tra bằng lookup): ${u.toolbox.map((id) => `${id} ${section(id)?.title ?? ""}`.trim()).join(" · ")}` : "",
  ].filter(Boolean).join("\n");
  // The first section worth reading straight away: the three steps for geometry, else the first after the identities.
  const firstId = u.toolbox.includes("hinh.0") ? "hinh.0" : u.toolbox.find((id) => !id.endsWith(".0")) ?? u.toolbox[0];
  const first = firstId ? section(firstId) : null;
  if (!first) return head;
  const room = CARD_MAX - head.length - 40 - first.title.length;
  if (room < 200) return head;
  const body = first.text.length > room ? `${first.text.slice(0, room - 1)}…` : first.text;
  return `${head}\n\n[hộp công cụ ${first.id} — ${first.title}]\n${body}`;
}

/** The lookup tool: a lesson or background card, or a toolbox section; null when unknown. */
export function lookupText(code: string): string | null {
  const s = section(code);
  if (s) return clip(`[hộp công cụ ${s.id} — ${s.title}]\n${s.text}`);
  const u = unit(code);
  if (!u) return null;
  if (u.level === "nen") return clip(`[KIẾN THỨC NỀN] ${u.code} · ${u.title} (${u.chapter})\nDùng cho: ${u.usedBy.map(named).join(" · ")}`);
  return clip([
    `[KIẾN THỨC] ${u.code} · ${u.title} (${u.term}, ${u.chapter})`,
    `Cốt lõi: ${u.core}`,
    `Dạng bài: ${u.problemTypes}`,
    `Lỗi hay gặp: ${errorsLine(u)}`,
    u.prereqs.length ? `Kiến thức nền: ${u.prereqs.map(named).join(" · ")}` : "",
    u.toolbox.length ? `Hộp công cụ: ${u.toolbox.join(", ")}` : "",
  ].filter(Boolean).join("\n"));
}

const clip = (s: string) => (s.length <= LOOKUP_MAX ? s : `${s.slice(0, LOOKUP_MAX - 1)}…`);

/** One line per lesson of the grade's program ("T9.9 · title · chapter"), for the classifier. */
export function kuIndex(grade: 6 | 9): string {
  return KNOWLEDGE.units.filter((u) => u.grade === grade && u.level === "bai")
    .map((u) => `${u.code} · ${u.title} · ${u.chapter}${u.term === "HK2" ? " · HK2" : ""}`).join("\n");
}

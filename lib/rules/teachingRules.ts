// lib/rules/teachingRules.ts — teaching rules the parents approve (DOMAIN §3.4; G7 plan P3, X3, X4). Pure.
// A proposed rule has version 0 (no effect). Approving gives it the next version of the child's
// rule set; a session pins rules_version at its start and uses approved rules up to that version,
// so a rule approved during a session takes effect from the next session (US8).

export const MAX_ACTIVE_RULES = 12; // X3 (phụ huynh chốt 19/11)
export const RULE_MAX_CHARS = 300; // X3; also a CHECK in study-launcher 0023

export type RuleStatus = "proposed" | "approved" | "rejected" | "superseded";
export interface RuleRow { id: string; status: RuleStatus; version: number; text: string; sourceKey: string | null }
export type RatingReason = "too_long" | "hard_words" | "answer_too_early" | "too_many_questions" | "good_example" | "clear";
export const RATING_REASONS: readonly RatingReason[] = ["too_long", "hard_words", "answer_too_early", "too_many_questions", "good_example", "clear"];
type Negative = "too_long" | "hard_words" | "answer_too_early" | "too_many_questions";

/** X4 (phụ huynh chốt 19/11): the rule a repeated 😕 reason proposes. No AI involved. */
export const RATING_RULE_TEXT: Record<Negative, string> = {
  too_long: "Trả lời ngắn hơn: mỗi lượt một ý, tối đa 3 dòng.",
  hard_words: "Dùng từ dễ hiểu; gặp từ toán học mới thì giải thích bằng một câu ngắn.",
  answer_too_early: "Không nói trước bước tiếp theo; để con thử trước rồi mới gợi ý.",
  too_many_questions: "Mỗi lượt chỉ hỏi con một câu.",
};
const NEGATIVE = Object.keys(RATING_RULE_TEXT) as Negative[];

export const rulesVersionNow = (rules: readonly RuleRow[]): number =>
  rules.filter((x) => x.status === "approved").reduce((m, x) => Math.max(m, x.version), 0);

export const nextVersion = (rules: readonly RuleRow[]): number => rules.reduce((m, x) => Math.max(m, x.version), 0) + 1;

export const activeRules = (rules: readonly RuleRow[], pinned: number): RuleRow[] =>
  rules.filter((x) => x.status === "approved" && x.version <= pinned).sort((a, b) => a.version - b.version);

export const canApprove = (rules: readonly RuleRow[]): boolean => rules.filter((x) => x.status === "approved").length < MAX_ACTIVE_RULES;

/** Added under layer ④ (teaching profile). The header keeps the core rules first. */
export function rulesBlock(rules: readonly RuleRow[]): string {
  if (!rules.length) return "";
  return ["[LUẬT BỐ MẸ ĐÃ DUYỆT — áp dụng trong khuôn khổ luật 1–12, không bao giờ được trái các luật đó]",
    ...rules.map((x) => `- ${x.text}`)].join("\n");
}

/** P3: the child's two latest ratings are both 😕 with a shared negative reason → one proposal. */
export function ratingProposal(latestTwo: readonly { face: string; reasons: readonly string[] }[], rules: readonly RuleRow[]): { sourceKey: string; text: string } | null {
  if (latestTwo.length < 2) return null;
  const [a, b] = latestTwo as [{ face: string; reasons: readonly string[] }, { face: string; reasons: readonly string[] }];
  if (a.face !== "hard" || b.face !== "hard") return null;
  const shared = NEGATIVE.find((k) => a.reasons.includes(k) && b.reasons.includes(k));
  if (!shared) return null;
  const sourceKey = `rating:${shared}`;
  if (rules.some((x) => x.sourceKey === sourceKey && (x.status === "proposed" || x.status === "approved"))) return null;
  return { sourceKey, text: RATING_RULE_TEXT[shared] };
}

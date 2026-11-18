// lib/parent/ruleActions.ts — what a parent's press on the rules page changes (DOMAIN §3.4; plan G7 X3). Pure.
import { z } from "zod";
import { canApprove, nextVersion, RULE_MAX_CHARS, type RuleRow, type RuleStatus } from "@/lib/rules/teachingRules";

const id = z.uuid();
const text = z.string().max(2000);
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), ruleId: id, text: text.optional() }).strict(),
  z.object({ action: z.literal("reject"), ruleId: id }).strict(),
  z.object({ action: z.literal("retire"), ruleId: id }).strict(),
  z.object({ action: z.literal("edit"), ruleId: id, text }).strict(),
  z.object({ action: z.literal("manual"), childId: id, text }).strict(),
]);
export type RuleAction = z.infer<typeof body>;
export const parseRuleAction = (raw: unknown): RuleAction | null => {
  const r = body.safeParse(raw);
  return r.success ? r.data : null;
};

export type RulePlan =
  | { updates: { id: string; status: RuleStatus; version?: number; text?: string }[]; insert?: { text: string; version: number; copySourceFrom: string | null } }
  | { error: "not_found" | "wrong_status" | "full" | "text" };

const clean = (t: string | undefined): string | null => {
  const v = t?.trim() ?? "";
  return v.length >= 1 && v.length <= RULE_MAX_CHARS ? v : null;
};

/** `rules` are all the rules of the child the action is about. */
export function planRuleAction(rules: readonly RuleRow[], a: RuleAction): RulePlan {
  if (a.action === "manual") {
    const t = clean(a.text);
    if (!t) return { error: "text" };
    if (!canApprove(rules)) return { error: "full" };
    return { updates: [], insert: { text: t, version: nextVersion(rules), copySourceFrom: null } };
  }
  const rule = rules.find((x) => x.id === a.ruleId);
  if (!rule) return { error: "not_found" };
  switch (a.action) {
    case "approve": {
      if (rule.status !== "proposed") return { error: "wrong_status" };
      const t = a.text === undefined ? rule.text : clean(a.text);
      if (!t) return { error: "text" };
      if (!canApprove(rules)) return { error: "full" };
      return { updates: [{ id: rule.id, status: "approved", version: nextVersion(rules), text: t }] };
    }
    case "reject":
      return rule.status === "proposed" ? { updates: [{ id: rule.id, status: "rejected" }] } : { error: "wrong_status" };
    case "retire":
      return rule.status === "approved" ? { updates: [{ id: rule.id, status: "superseded" }] } : { error: "wrong_status" };
    case "edit": {
      if (rule.status !== "approved") return { error: "wrong_status" };
      const t = clean(a.text);
      if (!t) return { error: "text" };
      return { updates: [{ id: rule.id, status: "superseded" }], insert: { text: t, version: nextVersion(rules), copySourceFrom: rule.id } };
    }
  }
}

export const RULE_ERROR_TEXT: Record<"not_found" | "wrong_status" | "full" | "text", string> = {
  not_found: "Không tìm thấy luật này.",
  wrong_status: "Luật này đã được xử lý rồi, tải lại trang nhé.",
  full: "Đã đủ 12 luật đang dùng, hãy tắt bớt một luật.",
  text: "Luật cần từ 1 đến 300 ký tự.",
};

import { describe, expect, it } from "vitest";
import { parseRuleAction, planRuleAction } from "@/lib/parent/ruleActions";
import type { RuleRow } from "@/lib/rules/teachingRules";

const r = (o: Partial<RuleRow>): RuleRow => ({ id: "r", status: "approved", version: 1, text: "Luật", sourceKey: null, ...o });
const RULES = [r({ id: "a", version: 1 }), r({ id: "b", version: 0, status: "proposed", text: "Đề xuất" }), r({ id: "c", version: 2, status: "superseded" })];
const U = "11111111-1111-4111-8111-111111111111";

describe("planRuleAction (§3.4, X3)", () => {
  it("approve a proposal: next version, text may be edited first", () => {
    expect(planRuleAction(RULES, { action: "approve", ruleId: "b", text: " Mỗi lượt một ý. " }))
      .toEqual({ updates: [{ id: "b", status: "approved", version: 3, text: "Mỗi lượt một ý." }] });
    expect(planRuleAction(RULES, { action: "approve", ruleId: "b" })).toEqual({ updates: [{ id: "b", status: "approved", version: 3, text: "Đề xuất" }] });
  });
  it("approving needs a proposal, and room (12 active)", () => {
    expect(planRuleAction(RULES, { action: "approve", ruleId: "a" })).toEqual({ error: "wrong_status" });
    expect(planRuleAction(RULES, { action: "approve", ruleId: "zz" })).toEqual({ error: "not_found" });
    const full = [...Array.from({ length: 12 }, (_, i) => r({ id: `x${i}`, version: i + 1 })), r({ id: "p", version: 0, status: "proposed" })];
    expect(planRuleAction(full, { action: "approve", ruleId: "p" })).toEqual({ error: "full" });
  });
  it("reject a proposal; retire an active rule", () => {
    expect(planRuleAction(RULES, { action: "reject", ruleId: "b" })).toEqual({ updates: [{ id: "b", status: "rejected" }] });
    expect(planRuleAction(RULES, { action: "reject", ruleId: "a" })).toEqual({ error: "wrong_status" });
    expect(planRuleAction(RULES, { action: "retire", ruleId: "a" })).toEqual({ updates: [{ id: "a", status: "superseded" }] });
    expect(planRuleAction(RULES, { action: "retire", ruleId: "b" })).toEqual({ error: "wrong_status" });
  });
  it("edit an active rule = supersede it + a new approved version (same source)", () => {
    expect(planRuleAction(RULES, { action: "edit", ruleId: "a", text: "Luật mới" }))
      .toEqual({ updates: [{ id: "a", status: "superseded" }], insert: { text: "Luật mới", version: 3, copySourceFrom: "a" } });
  });
  it("a rule the parents write is active from the next session (X3)", () => {
    expect(planRuleAction(RULES, { action: "manual", childId: U, text: "Gọi con là em." })).toEqual({ updates: [], insert: { text: "Gọi con là em.", version: 3, copySourceFrom: null } });
  });
  it("text must be 1–300 characters", () => {
    expect(planRuleAction(RULES, { action: "manual", childId: U, text: "   " })).toEqual({ error: "text" });
    expect(planRuleAction(RULES, { action: "edit", ruleId: "a", text: "x".repeat(301) })).toEqual({ error: "text" });
  });
});

describe("parseRuleAction", () => {
  it("accepts the five actions", () => {
    expect(parseRuleAction({ action: "approve", ruleId: U })).toEqual({ action: "approve", ruleId: U });
    expect(parseRuleAction({ action: "manual", childId: U, text: "a" })).toEqual({ action: "manual", childId: U, text: "a" });
  });
  it("rejects unknown actions and missing fields", () => {
    expect(parseRuleAction({ action: "delete", ruleId: U })).toBeNull();
    expect(parseRuleAction({ action: "edit", ruleId: U })).toBeNull();
    expect(parseRuleAction({ action: "approve", ruleId: "abc" })).toBeNull();
  });
});

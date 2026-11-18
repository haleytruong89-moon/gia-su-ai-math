import "server-only";
// lib/parent/rules.ts — teaching rules for the parents' page (DOMAIN §3.4; plan G7 P3, X3).
// Service role: every query is filtered on the parent's family_id.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addUsage } from "@/lib/db/supabaseRepo";
import type { ParentActor } from "@/lib/entry";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RuleRow } from "@/lib/rules/teachingRules";
import { draftRule } from "@/lib/tutor/ruleDraft";
import type { ModelClient } from "@/lib/tutor/turn";
import { planRuleAction, type RuleAction, type RulePlan } from "./ruleActions";

export interface RuleView extends RuleRow {
  source: "parent_feedback" | "child_rating" | "manual";
  approvedAt: string | null;
  createdAt: string;
  /** For a rule drafted from a parent note: the problem to review it in. */
  problemId: string | null;
}
export interface ChildRules { childId: string; name: string; grade: number | null; rules: RuleView[] }

const COLS = "id, child_id, status, version, text, source_key, source, source_ids, approved_at, created_at";
type Row = { id: string; child_id: string; status: RuleRow["status"]; version: number; text: string; source_key: string | null;
  source: RuleView["source"]; source_ids: string[] | null; approved_at: string | null; created_at: string };

function fail(where: string, e: { message: string }): never {
  throw new Error(`${where}: ${e.message}`);
}

const toRow = (r: Row): RuleRow => ({ id: r.id, status: r.status, version: r.version, text: r.text, sourceKey: r.source_key });

export async function familyRules(parent: ParentActor, db: SupabaseClient = createAdminClient()): Promise<ChildRules[]> {
  const { data: kids, error } = await db.from("profiles").select("id, display_name, grade")
    .eq("family_id", parent.familyId).eq("role", "child").order("created_at", { ascending: true });
  if (error) fail("rules.children", error);
  const t = db.schema("tutor");
  const { data: rows, error: e2 } = await t.from("teaching_rules").select(COLS)
    .eq("family_id", parent.familyId).is("deleted_at", null).order("created_at", { ascending: true }).returns<Row[]>();
  if (e2) fail("rules.list", e2);
  const fbIds = (rows ?? []).filter((r) => r.source === "parent_feedback").flatMap((r) => r.source_ids ?? []);
  const { data: fb, error: e3 } = fbIds.length
    ? await t.from("parent_feedback").select("id, problem_id").eq("family_id", parent.familyId).in("id", fbIds)
    : { data: [], error: null };
  if (e3) fail("rules.feedback", e3);
  const problemOf = new Map((fb ?? []).map((f) => [f.id as string, f.problem_id as string]));
  return (kids ?? []).map((k) => ({
    childId: k.id as string,
    name: (k.display_name as string | null) ?? "Con",
    grade: (k.grade as number | null) ?? null,
    rules: (rows ?? []).filter((r) => r.child_id === k.id).map((r) => ({
      ...toRow(r), source: r.source, approvedAt: r.approved_at, createdAt: r.created_at,
      problemId: r.source === "parent_feedback" ? (problemOf.get((r.source_ids ?? [])[0] ?? "") ?? null) : null,
    })),
  }));
}

/** Applies one press of the rules page. Returns an error code for the page, or null. */
export async function applyRuleAction(parent: ParentActor, a: RuleAction, now: Date, db: SupabaseClient = createAdminClient()):
  Promise<Extract<RulePlan, { error: string }>["error"] | null> {
  const t = db.schema("tutor");
  let childId: string;
  if (a.action === "manual") {
    const { data: kid, error } = await db.from("profiles").select("id").eq("id", a.childId).eq("family_id", parent.familyId).eq("role", "child").maybeSingle();
    if (error) fail("rules.child", error);
    if (!kid) return "not_found";
    childId = a.childId;
  } else {
    const { data: rule, error } = await t.from("teaching_rules").select("child_id").eq("id", a.ruleId).eq("family_id", parent.familyId).is("deleted_at", null).maybeSingle();
    if (error) fail("rules.rule", error);
    if (!rule) return "not_found";
    childId = rule.child_id as string;
  }
  const { data: rows, error: e2 } = await t.from("teaching_rules").select(COLS).eq("child_id", childId).is("deleted_at", null).returns<Row[]>();
  if (e2) fail("rules.child_rules", e2);
  const plan = planRuleAction((rows ?? []).map(toRow), a);
  if ("error" in plan) return plan.error;
  const at = now.toISOString();
  for (const u of plan.updates) {
    const approving = u.status === "approved";
    const { error } = await t.from("teaching_rules").update({
      status: u.status, updated_at: at,
      ...(u.version !== undefined ? { version: u.version } : {}),
      ...(u.text !== undefined ? { text: u.text } : {}),
      ...(approving ? { approved_by: parent.userId, approved_at: at } : {}),
    }).eq("id", u.id).eq("family_id", parent.familyId);
    if (error) fail("rules.update", error);
  }
  if (plan.insert) {
    const from = plan.insert.copySourceFrom ? (rows ?? []).find((r) => r.id === plan.insert!.copySourceFrom) : undefined;
    const { error } = await t.from("teaching_rules").insert({
      family_id: parent.familyId, child_id: childId, text: plan.insert.text, status: "approved", version: plan.insert.version,
      source: from?.source ?? "manual", source_key: from?.source_key ?? null, source_ids: from?.source_ids ?? [],
      approved_by: parent.userId, approved_at: at, created_by: parent.userId, created_at: at, updated_at: at,
    });
    if (error) fail("rules.insert", error);
  }
  return null;
}

/**
 * P3: a parent note (👍/👎 + note) → Sonnet drafts one rule → proposed (version 0). The same note
 * saved again replaces the still-proposed draft instead of adding a second one. Never throws.
 */
export async function proposeFromFeedback(parent: ParentActor, feedbackId: string, d: { client: ModelClient; model: string; prompt: string;
  promptVersion: string; now: Date }, db: SupabaseClient = createAdminClient()): Promise<void> {
  try {
    const t = db.schema("tutor");
    const { data: fb, error } = await t.from("parent_feedback").select("id, child_id, problem_id, message_id, thumb, note")
      .eq("id", feedbackId).eq("family_id", parent.familyId).maybeSingle();
    if (error) fail("draft.feedback", error);
    const note = (fb?.note as string | null)?.trim();
    if (!fb || !note || !fb.message_id) return;
    const { data: msgs, error: e2 } = await t.from("messages").select("id, role, content")
      .eq("problem_id", fb.problem_id as string).is("deleted_at", null).neq("role", "system").order("created_at", { ascending: true });
    if (e2) fail("draft.messages", e2);
    const list = msgs ?? [];
    const i = list.findIndex((m) => m.id === fb.message_id);
    if (i < 0) return;
    const before = i > 0 && list[i - 1]?.role === "child" ? (list[i - 1]!.content as string) : null;
    const r = await draftRule(d.client, { model: d.model, prompt: d.prompt },
      { tutorText: list[i]!.content as string, childBefore: before, thumb: fb.thumb as "up" | "down", note });
    if (r.call) {
      const { error: e3 } = await t.from("model_calls").insert({
        family_id: parent.familyId, child_id: fb.child_id, problem_id: fb.problem_id, purpose: "rules", model: r.call.model,
        prompt_version: d.promptVersion, raw_output: r.call.raw, tokens_in: r.call.tokens.in, tokens_cached: r.call.tokens.cached,
        tokens_out: r.call.tokens.out, cost_usd: r.call.costUsd,
      });
      if (e3) fail("draft.model_call", e3);
      await addUsage(db, parent.familyId, d.now, r.call.costUsd);
    }
    if (!r.text) return;
    const key = `feedback:${feedbackId}`;
    const at = d.now.toISOString();
    const { data: open, error: e4 } = await t.from("teaching_rules").select("id")
      .eq("family_id", parent.familyId).eq("source_key", key).eq("status", "proposed").is("deleted_at", null).maybeSingle();
    if (e4) fail("draft.open", e4);
    const { error: e5 } = open
      ? await t.from("teaching_rules").update({ text: r.text, updated_at: at }).eq("id", open.id as string)
      : await t.from("teaching_rules").insert({
        family_id: parent.familyId, child_id: fb.child_id, text: r.text, status: "proposed", version: 0, source: "parent_feedback",
        source_key: key, source_ids: [feedbackId], created_by: parent.userId, created_at: at, updated_at: at,
      });
    if (e5) fail("draft.save", e5);
  } catch (e) {
    console.error("rule draft failed", e instanceof Error ? e.message : "unknown");
  }
}

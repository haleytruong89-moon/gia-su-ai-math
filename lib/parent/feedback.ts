import "server-only";
// lib/parent/feedback.ts — store a parent's 👍/👎 (+ note) on one tutor turn (DOMAIN §1 parent_feedback).
// Service role: the family is checked here. One feedback per parent per turn: a second press updates it.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParentActor } from "@/lib/entry";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FeedbackInput } from "./feedbackInput";

export type SaveFeedback = { ok: true; feedbackId: string } | { ok: false; error: "not_found" };

export async function saveFeedback(parent: ParentActor, f: FeedbackInput, now: Date, db: SupabaseClient = createAdminClient()): Promise<SaveFeedback> {
  const t = db.schema("tutor");
  const { data: msg, error } = await t.from("messages").select("id, child_id, problem_id, role")
    .eq("id", f.messageId).eq("problem_id", f.problemId).eq("family_id", parent.familyId).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(`feedback.message: ${error.message}`);
  if (!msg || msg.role !== "tutor") return { ok: false, error: "not_found" };
  const { data: old, error: e2 } = await t.from("parent_feedback").select("id")
    .eq("family_id", parent.familyId).eq("message_id", f.messageId).eq("created_by", parent.userId).maybeSingle();
  if (e2) throw new Error(`feedback.read: ${e2.message}`);
  if (old) {
    const { error: e3 } = await t.from("parent_feedback").update({ thumb: f.thumb, note: f.note, updated_at: now.toISOString() }).eq("id", old.id as string);
    if (e3) throw new Error(`feedback.update: ${e3.message}`);
    return { ok: true, feedbackId: old.id as string };
  }
  const { data: row, error: e4 } = await t.from("parent_feedback").insert({
    family_id: parent.familyId, child_id: msg.child_id, problem_id: f.problemId, message_id: f.messageId,
    thumb: f.thumb, note: f.note, created_by: parent.userId,
  }).select("id").single();
  if (e4 || !row) throw new Error(`feedback.insert: ${e4?.message ?? "no row"}`);
  return { ok: true, feedbackId: row.id as string };
}

import "server-only";
// lib/report/feedbackLoad.ts — "Con báo cô sai" for the evening report (D32): the tutor messages one child flagged on one
// VN day, with the child's words. Service role: every query is filtered on the parent's family_id.
import type { SupabaseClient } from "@supabase/supabase-js";
import { FEEDBACK_KINDS, shorten, type FeedbackItem, type FeedbackKind } from "@/lib/rules/feedback";
import { addDays } from "@/lib/time";
import { fail } from "./childDay";

const vnStart = (date: string) => `${date}T00:00:00+07:00`;

export async function loadFeedbackDay(db: SupabaseClient, familyId: string, childId: string, date: string): Promise<FeedbackItem[]> {
  const t = db.schema("tutor");
  const { data, error } = await t.from("message_feedback").select("problem_id, message_id, kind, comment, created_at")
    .eq("family_id", familyId).eq("child_id", childId).is("deleted_at", null)
    .gte("created_at", vnStart(date)).lt("created_at", vnStart(addDays(date, 1))).order("created_at", { ascending: true });
  // Until the Launcher's SQL 0027 has run (merge order), the table does not exist: the report shows nothing for it.
  if (error && (error.code === "42P01" || error.code === "PGRST205")) return [];
  if (error) fail("report.feedback", error);
  const rows = data ?? [];
  if (!rows.length) return [];
  const { data: msgs, error: e2 } = await t.from("messages").select("id, content")
    .eq("family_id", familyId).in("id", [...new Set(rows.map((r) => r.message_id as string))]);
  if (e2) fail("report.feedback_messages", e2);
  const text = new Map((msgs ?? []).map((m) => [m.id as string, m.content as string]));
  return rows
    .filter((r) => (FEEDBACK_KINDS as readonly string[]).includes(r.kind as string))
    .map((r) => ({
      problemId: r.problem_id as string,
      kind: r.kind as FeedbackKind,
      tutorText: shorten(text.get(r.message_id as string) ?? ""),
      comment: (r.comment as string | null) ?? null,
      at: r.created_at as string,
    }));
}

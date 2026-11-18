import "server-only";
// lib/report/attentionSync.ts — writes the child's "cần chú ý" lines of the day to the Launcher's
// public.learning_attention (0021: slot 1–2, parents read, servers write). Called when a problem
// ends and when the child rates a session; the Launcher's 20:00 reminder counts these lines.
import type { SupabaseClient } from "@supabase/supabase-js";
import { attentionLines } from "./attention";
import { childDayFlags, fail } from "./childDay";

export const ATTENTION_SOURCE = "tutor:toan";

export async function syncAttention(db: SupabaseClient, familyId: string, childId: string, date: string, now: Date): Promise<void> {
  const lines = attentionLines(await childDayFlags(db, familyId, childId, date));
  if (lines.length) {
    const { error } = await db.from("learning_attention").upsert(
      lines.map((body, i) => ({ family_id: familyId, child_id: childId, local_date: date, source: ATTENTION_SOURCE, slot: i + 1, body, updated_at: now.toISOString() })),
      { onConflict: "child_id,local_date,source,slot" },
    );
    if (error) fail("attention.upsert", error);
  }
  // A line that no longer applies (fewer flags than before) is removed.
  const { error: e2 } = await db.from("learning_attention").delete()
    .eq("family_id", familyId).eq("child_id", childId).eq("local_date", date).eq("source", ATTENTION_SOURCE).gt("slot", lines.length);
  if (e2) fail("attention.delete", e2);
}

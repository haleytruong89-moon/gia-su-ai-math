import "server-only";
// lib/report/childDay.ts — one child's VN day read from schema tutor (service role: always filtered on family_id).
import type { SupabaseClient } from "@supabase/supabase-js";
import { unit } from "@/lib/knowledge/load";
import { SAFE_LINE_TEXTS } from "@/lib/copy";
import { dayFlags, type Flag } from "./flags";
import { factsFromRows, type CallRowLite, type ProblemRowLite, type ToolRowLite } from "./facts";

export const kuTitle = (code: string): string | null => unit(code)?.title ?? null;

export interface DayRatings { face: "easy" | "ok" | "hard"; reasons: string[]; comment?: string | null }

export function fail(where: string, e: { message: string }): never {
  throw new Error(`${where}: ${e.message}`);
}

export const PROBLEM_COLS = "id, session_id, child_id, status, hint_level_max, nan_jumps, u_level, ku_code, exam_slot, prereq_gaps, confirmed_statement, created_at";


/** One child's day, ready for the flags (also used to write the Launcher's attention lines). */
export async function loadChildDay(db: SupabaseClient, familyId: string, childId: string, date: string) {
  const t = db.schema("tutor");
  const { data: sessions, error: e1 } = await t.from("study_sessions").select("id, status")
    .eq("family_id", familyId).eq("child_id", childId).eq("date_vn", date).is("deleted_at", null);
  if (e1) fail("report.sessions", e1);
  const sids = (sessions ?? []).map((s) => s.id as string);
  if (!sids.length) return { sessions: 0, sessionsAbandoned: 0, problems: [] as ProblemRowLite[], calls: [] as CallRowLite[], tools: [] as ToolRowLite[], ratings: [] as DayRatings[],
    safeLines: [] as { problem_id: string | null }[] };
  const { data: problems, error: e2 } = await t.from("problems").select(PROBLEM_COLS)
    .eq("family_id", familyId).in("session_id", sids).is("deleted_at", null).order("created_at", { ascending: true });
  if (e2) fail("report.problems", e2);
  const pids = (problems ?? []).map((p) => p.id as string);
  const [calls, tools, ratings, safeLines] = await Promise.all([
    pids.length
      ? t.from("model_calls").select("problem_id, purpose, guard_result, guard_reasons, raw_output").eq("family_id", familyId).in("problem_id", pids).in("purpose", ["classify", "tutor", "reference"])
      : Promise.resolve({ data: [], error: null }),
    pids.length
      ? t.from("tool_calls").select("problem_id, tool, output").eq("family_id", familyId).in("problem_id", pids).eq("tool", "math_check").eq("ok", false)
      : Promise.resolve({ data: [], error: null }),
    t.from("ratings").select("face, reasons, comment").eq("family_id", familyId).in("session_id", sids),
    // G8-fix: tutor messages that were a pre-written safe line (same pattern as gapsLoad's CARDS_DONE query).
    pids.length
      ? t.from("messages").select("problem_id").eq("family_id", familyId).in("problem_id", pids).eq("role", "tutor")
        .in("content", [...SAFE_LINE_TEXTS]).is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (calls.error) fail("report.calls", calls.error);
  if (tools.error) fail("report.tools", tools.error);
  if (ratings.error) fail("report.ratings", ratings.error);
  if (safeLines.error) fail("report.safe_lines", safeLines.error);
  return {
    sessions: sids.length,
    sessionsAbandoned: (sessions ?? []).filter((s) => s.status === "abandoned").length,
    problems: (problems ?? []) as ProblemRowLite[],
    calls: (calls.data ?? []) as CallRowLite[],
    tools: (tools.data ?? []) as ToolRowLite[],
    ratings: (ratings.data ?? []) as DayRatings[],
    safeLines: (safeLines.data ?? []) as { problem_id: string | null }[],
  };
}

/** The flags of one child's day (DOMAIN §4.7), in the parents' priority order. */
export async function childDayFlags(db: SupabaseClient, familyId: string, childId: string, date: string): Promise<Flag[]> {
  const d = await loadChildDay(db, familyId, childId, date);
  return dayFlags(factsFromRows(d), kuTitle);
}


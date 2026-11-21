import "server-only";
// lib/report/load.ts — the parents' evening report (US7): both children of the family, one VN day.
// Service role, so EVERY query is filtered on the parent's family_id (RLS does not apply here).
import type { SupabaseClient } from "@supabase/supabase-js";
import { problemThread, type Thread } from "@/lib/db/supabaseRepo";
import type { ParentActor } from "@/lib/entry";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail } from "./childDay";
import { kuTitle, loadChildDay, PROBLEM_COLS } from "./childDay";
import { costFlag, dayFlags, type Flag } from "./flags";
import { factsFromRows, type ProblemRowLite } from "./facts";
import type { CardGap } from "./cardGaps";
import { loadCardGaps, loadReviewDay } from "./gapsLoad";

export { kuTitle };

export interface ReportProblem extends ProblemRowLite { kuTitle: string | null }
export interface ChildDay {
  childId: string;
  name: string;
  grade: number | null;
  minutes: number;
  sessions: number;
  flags: Flag[];
  problems: ReportProblem[];
  ratings: { face: "easy" | "ok" | "hard"; reasons: string[] }[];
  /** G6b: start-of-session review of the day (answered questions, right ones). */
  review: { asked: number; correct: number };
}
export interface DayReport {
  date: string;
  children: ChildDay[];
  cost: { costUsd: number; mode: "normal" | "economy"; flag: string | null };
  /** G6b (C5): what the tutor met without an approved card, ≥ 2 times in the last 7 days. */
  cardGaps: CardGap[];
}

export async function loadDayReport(parent: ParentActor, date: string, db: SupabaseClient = createAdminClient()): Promise<DayReport> {
  const { data: kids, error } = await db.from("profiles").select("id, display_name, grade")
    .eq("family_id", parent.familyId).eq("role", "child").order("created_at", { ascending: true });
  if (error) fail("report.children", error);
  const t = db.schema("tutor");
  const ids = (kids ?? []).map((k) => k.id as string);
  const { data: summary, error: e2 } = ids.length
    ? await t.from("daily_summary_by_subject").select("child_id, minutes").eq("family_id", parent.familyId).in("child_id", ids).eq("date_vn", date)
    : { data: [], error: null };
  if (e2) fail("report.minutes", e2);
  const children = await Promise.all((kids ?? []).map(async (k): Promise<ChildDay> => {
    const [d, review] = await Promise.all([loadChildDay(db, parent.familyId, k.id as string, date),
      loadReviewDay(db, parent.familyId, k.id as string, date)]);
    return {
      childId: k.id as string,
      name: (k.display_name as string | null) ?? "Con",
      grade: (k.grade as number | null) ?? null,
      minutes: (summary ?? []).filter((s) => s.child_id === k.id).reduce((n, s) => n + Number(s.minutes ?? 0), 0),
      sessions: d.sessions,
      flags: dayFlags(factsFromRows(d), kuTitle),
      problems: d.problems.map((p) => ({ ...p, kuTitle: p.ku_code ? kuTitle(p.ku_code) : null })),
      ratings: d.ratings,
      review,
    };
  }));
  const month = `${new Date().toISOString().slice(0, 7)}-01`;
  const { data: usage, error: e3 } = await t.from("usage_monthly").select("cost_usd, model_mode")
    .eq("family_id", parent.familyId).eq("month", month).maybeSingle();
  if (e3) fail("report.usage", e3);
  const costUsd = Number(usage?.cost_usd ?? 0);
  const mode = usage?.model_mode === "economy" ? "economy" : "normal";
  const grades = new Map((kids ?? []).filter((k) => k.grade === 6 || k.grade === 9).map((k) => [k.id as string, k.grade as 6 | 9]));
  const cardGaps = await loadCardGaps(db, parent.familyId, grades, date);
  return { date, children, cost: { costUsd, mode, flag: costFlag({ costUsd, mode }) }, cardGaps };
}

export interface ParentThread extends Thread {
  childId: string;
  date: string;
  problem: ReportProblem;
  /** Parent feedback already given, by tutor message id. */
  feedback: Record<string, { thumb: "up" | "down"; note: string | null }>;
  /** G7c (P4): the verified reference solution, when the child solved it alone. */
  reference: { steps: string[]; finalAnswer: string } | null;
}

/** One problem of the family for the review page; null when it is not this family's. */
export async function loadParentThread(parent: ParentActor, problemId: string, db: SupabaseClient = createAdminClient()): Promise<ParentThread | null> {
  if (!/^[0-9a-f-]{36}$/i.test(problemId)) return null;
  const t = db.schema("tutor");
  const { data: p, error } = await t.from("problems").select(PROBLEM_COLS)
    .eq("id", problemId).eq("family_id", parent.familyId).is("deleted_at", null).maybeSingle();
  if (error) fail("thread.problem", error);
  if (!p) return null;
  const thread = await problemThread(problemId, p.child_id as string, db);
  if (!thread) return null;
  const { data: s, error: e2 } = await t.from("study_sessions").select("date_vn").eq("id", p.session_id as string).maybeSingle();
  if (e2) fail("thread.session", e2);
  const { data: fb, error: e3 } = await t.from("parent_feedback").select("message_id, thumb, note")
    .eq("family_id", parent.familyId).eq("problem_id", problemId).eq("created_by", parent.userId);
  if (e3) fail("thread.feedback", e3);
  const feedback: ParentThread["feedback"] = {};
  for (const f of fb ?? []) if (f.message_id) feedback[f.message_id as string] = { thumb: f.thumb as "up" | "down", note: (f.note as string | null) ?? null };
  const { data: ref, error: e4 } = await t.from("reference_solutions").select("content, final_answer")
    .eq("family_id", parent.familyId).eq("problem_id", problemId).maybeSingle();
  if (e4) fail("thread.reference", e4);
  const row = p as unknown as ProblemRowLite;
  return {
    ...thread, childId: p.child_id as string, date: (s?.date_vn as string | undefined) ?? "",
    problem: { ...row, kuTitle: row.ku_code ? kuTitle(row.ku_code) : null }, feedback,
    reference: ref ? { steps: String(ref.content).split("\n"), finalAnswer: (ref.final_answer as string | null) ?? "" } : null,
  };
}

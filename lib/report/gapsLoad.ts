import "server-only";
// lib/report/gapsLoad.ts — the events behind "Thẻ cần bổ sung" (G6b, C5) and the day's review results, for one family.
// Service role: every query is filtered on the parent's family_id. No new SQL (model_calls, messages, problems, review_attempts).
import type { SupabaseClient } from "@supabase/supabase-js";
import { CARDS_DONE } from "@/lib/copy";
import { card } from "@/lib/knowledge/cards";
import { addDays } from "@/lib/time";
import { fail } from "./childDay";
import { cardGaps, GAP_DAYS, type CardGap, type GapEvent } from "./cardGaps";

const vnStart = (date: string) => `${date}T00:00:00+07:00`;

function parsed(raw: string | null): { the_hien?: unknown; the_thieu?: unknown } {
  try {
    return raw ? (JSON.parse(raw) as { the_hien?: unknown; the_thieu?: unknown }) : {};
  } catch {
    return {};
  }
}

export async function loadCardGaps(db: SupabaseClient, familyId: string, grades: Map<string, 6 | 9>, date: string): Promise<CardGap[]> {
  const t = db.schema("tutor");
  const from = vnStart(addDays(date, -(GAP_DAYS - 1)));
  const to = vnStart(addDays(date, 1));
  const [calls, done, unknown] = await Promise.all([
    t.from("model_calls").select("child_id, problem_id, raw_output, created_at").eq("family_id", familyId).eq("purpose", "tutor")
      .not("message_id", "is", null).gte("created_at", from).lt("created_at", to),
    t.from("messages").select("child_id, problem_id, created_at").eq("family_id", familyId).eq("role", "tutor").eq("content", CARDS_DONE)
      .is("deleted_at", null).gte("created_at", from).lt("created_at", to),
    t.from("problems").select("id, child_id, confirmed_statement, created_at").eq("family_id", familyId).eq("statement_confirmed", true)
      .is("ku_code", null).is("deleted_at", null).gte("created_at", from).lt("created_at", to),
  ]);
  if (calls.error) fail("gaps.calls", calls.error);
  if (done.error) fail("gaps.done", done.error);
  if (unknown.error) fail("gaps.unknown", unknown.error);

  // The card each "2 ways were not enough" message was about: the newest card shown before it in the same problem.
  const doneProblems = [...new Set((done.data ?? []).map((m) => m.problem_id as string))];
  const { data: shownCards, error: e4 } = doneProblems.length
    ? await t.from("messages").select("problem_id, card_ref, created_at").eq("family_id", familyId).in("problem_id", doneProblems)
      .not("card_ref", "is", null).order("created_at", { ascending: true })
    : { data: [], error: null };
  if (e4) fail("gaps.cards", e4);
  const pids = [...new Set([...(calls.data ?? []).map((c) => c.problem_id as string), ...doneProblems])].filter(Boolean);
  const { data: probs, error: e5 } = pids.length
    ? await t.from("problems").select("id, confirmed_statement").eq("family_id", familyId).in("id", pids)
    : { data: [], error: null };
  if (e5) fail("gaps.problems", e5);
  const statement = new Map((probs ?? []).map((p) => [p.id as string, (p.confirmed_statement as string | null) ?? null]));

  const events: GapEvent[] = [];
  const base = (childId: string, problemId: string, at: string) => {
    const grade = grades.get(childId);
    return grade ? { at, grade, childId, problemId, statement: statement.get(problemId) ?? null } : null;
  };
  for (const c of calls.data ?? []) {
    const b = base(c.child_id as string, c.problem_id as string, c.created_at as string);
    if (!b) continue;
    const o = parsed(c.raw_output as string | null);
    if (typeof o.the_thieu === "string" && o.the_thieu.trim()) events.push({ ...b, kind: "the_thieu", key: o.the_thieu.trim().slice(0, 80) });
    if (typeof o.the_hien === "string" && !card(o.the_hien)) events.push({ ...b, kind: "no_card", key: o.the_hien });
  }
  for (const m of done.data ?? []) {
    const b = base(m.child_id as string, m.problem_id as string, m.created_at as string);
    const ref = (shownCards ?? []).filter((s) => s.problem_id === m.problem_id && (s.created_at as string) < (m.created_at as string)).at(-1)?.card_ref as string | undefined;
    if (b && ref) events.push({ ...b, kind: "het_cach", key: `het_cach:${ref.split("#")[0]}` });
  }
  for (const p of unknown.data ?? []) {
    const grade = grades.get(p.child_id as string);
    if (grade) events.push({ at: p.created_at as string, grade, childId: p.child_id as string, problemId: p.id as string, kind: "unknown_ku",
      key: `unknown_ku:lop${grade}`, statement: (p.confirmed_statement as string | null) ?? null });
  }
  return cardGaps(events, new Date(`${date}T05:00:00Z`), (code) => card(code) !== null);
}

/** "Ôn đầu buổi: x câu, đúng y" for one child and one VN day ("Để sau" is not an answer). */
export async function loadReviewDay(db: SupabaseClient, familyId: string, childId: string, date: string): Promise<{ asked: number; correct: number }> {
  const { data, error } = await db.schema("tutor").from("review_attempts").select("result").eq("family_id", familyId).eq("child_id", childId)
    .gte("created_at", vnStart(date)).lt("created_at", vnStart(addDays(date, 1)));
  if (error) fail("report.review", error);
  const answered = (data ?? []).filter((r) => r.result !== "skipped");
  return { asked: answered.length, correct: answered.filter((r) => r.result === "correct").length };
}

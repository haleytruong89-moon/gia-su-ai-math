import "server-only";
// lib/db/supabaseRepo.ts — TutorRepo on schema `tutor` (SQL lives in the study-launcher repo,
// migration 0017). Service role: every call site has already checked the actor from the session.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Msg } from "@/lib/tutor/assemble";
import type { FoundMessage, ProblemRow, ProblemStatus, StoredReply, StuckKind, TutorRepo } from "@/lib/tutor/repo";

const UNIQUE_VIOLATION = "23505";

function fail(where: string, error: { message: string } | null): never {
  throw new Error(`${where}: ${error?.message ?? "no row"}`);
}

interface ProblemDb {
  id: string; child_id: string; family_id: string; session_id: string; status: ProblemStatus; turn_count: number;
  hint_level: number; wrong_count: number; stuck_kind: StuckKind | null; statement_confirmed: boolean;
}
interface MessageDb { id: string; role: "child" | "tutor" | "system"; content: string; buttons: string[] | null;
  hint_level: number | null; client_msg_id: string | null; created_at: string; problem_id: string }

const PROBLEM_COLS = "id, child_id, family_id, session_id, status, turn_count, hint_level, wrong_count, stuck_kind, statement_confirmed";
const MESSAGE_COLS = "id, role, content, buttons, hint_level, client_msg_id, created_at, problem_id";

function replyFrom(p: Pick<ProblemDb, "id" | "status" | "turn_count">, m: MessageDb): StoredReply {
  return { problemId: p.id, message: m.content, buttons: m.buttons ?? [], hintLevel: m.hint_level ?? 0, status: p.status, turnCount: p.turn_count };
}

export function supabaseRepo(db: SupabaseClient = createAdminClient()): TutorRepo {
  const t = () => db.schema("tutor");

  return {
    async openSession(a) {
      const { data: active, error } = await t().from("study_sessions").select("id, date_vn")
        .eq("child_id", a.actor.userId).eq("status", "active").is("deleted_at", null).maybeSingle();
      if (error) fail("openSession.read", error);
      if (active && active.date_vn === a.dateVn) return { id: active.id as string, reused: true };
      if (active) {
        // An active session left from an earlier day (DOMAIN §3.1): close it before opening today's.
        const { error: e } = await t().from("study_sessions").update({ status: "abandoned", ended_at: new Date().toISOString() }).eq("id", active.id);
        if (e) fail("openSession.abandon", e);
      }
      const { data, error: e2 } = await t().from("study_sessions").insert({
        family_id: a.actor.familyId, child_id: a.actor.userId, device: a.device, date_vn: a.dateVn,
        profile_version: a.actor.profileVersion, prompt_version: a.promptVersion, model_main: a.modelMain, created_by: a.actor.userId,
      }).select("id").single();
      if (e2?.code === UNIQUE_VIOLATION) return this.openSession(a); // a parallel tap opened it first
      if (e2 || !data) fail("openSession.insert", e2);
      return { id: data.id as string, reused: false };
    },

    async createProblem(a) {
      const { data, error } = await t().from("problems").insert({
        family_id: a.actor.familyId, child_id: a.actor.userId, session_id: a.sessionId, stuck_kind: a.stuckKind, created_by: a.actor.userId,
      }).select("id").single();
      if (error || !data) fail("createProblem", error);
      return { id: data.id as string };
    },

    async setProblemStatus(problemId, status, now) {
      const closedAt = status === "in_progress" ? null : now.toISOString();
      const { error } = await t().from("problems").update({ status, closed_at: closedAt, updated_at: now.toISOString() }).eq("id", problemId);
      if (error) fail("setProblemStatus", error);
    },

    async getProblemForChild(problemId, childId) {
      if (!/^[0-9a-f-]{36}$/i.test(problemId)) return null;
      const { data: p, error } = await t().from("problems").select(PROBLEM_COLS)
        .eq("id", problemId).eq("child_id", childId).is("deleted_at", null).maybeSingle<ProblemDb>();
      if (error) fail("getProblem", error);
      if (!p) return null;
      const { data: rows, error: e2 } = await t().from("messages").select(MESSAGE_COLS)
        .eq("problem_id", p.id).is("deleted_at", null).neq("role", "system").order("created_at", { ascending: true }).returns<MessageDb[]>();
      if (e2) fail("getProblem.messages", e2);
      const list = rows ?? [];
      const last = list.at(-1);
      const answered = last?.role === "child" ? list.slice(0, -1) : list;
      const history: Msg[] = answered.map((m) => ({ role: m.role === "child" ? "user" : "assistant", content: m.content }));
      const row: ProblemRow = {
        id: p.id, childId: p.child_id, familyId: p.family_id, sessionId: p.session_id, status: p.status, turnCount: p.turn_count,
        hintLevel: p.hint_level, wrongCount: p.wrong_count, stuckKind: p.stuck_kind, statementConfirmed: p.statement_confirmed, history,
        pending: last?.role === "child" ? { messageId: last.id, clientMsgId: last.client_msg_id, text: last.content, at: new Date(last.created_at) } : null,
      };
      return row;
    },

    async findByClientMsg(childId, clientMsgId): Promise<FoundMessage | null> {
      const { data: m, error } = await t().from("messages").select(MESSAGE_COLS)
        .eq("child_id", childId).eq("client_msg_id", clientMsgId).maybeSingle<MessageDb>();
      if (error) fail("findByClientMsg", error);
      if (!m) return null;
      const { data: next, error: e2 } = await t().from("messages").select(MESSAGE_COLS)
        .eq("problem_id", m.problem_id).gt("created_at", m.created_at).is("deleted_at", null).neq("role", "system")
        .order("created_at", { ascending: true }).limit(1).maybeSingle<MessageDb>();
      if (e2) fail("findByClientMsg.next", e2);
      let reply: StoredReply | null = null;
      if (next?.role === "tutor") {
        const { data: p, error: e3 } = await t().from("problems").select("id, status, turn_count").eq("id", m.problem_id).single();
        if (e3 || !p) fail("findByClientMsg.problem", e3);
        reply = replyFrom(p as ProblemDb, next);
      }
      return { problemId: m.problem_id, messageId: m.id, text: m.content, at: new Date(m.created_at), reply };
    },

    async insertChildMessage(a) {
      // created_at is the database clock, so the tutor reply (inserted later) always sorts after it.
      const { data, error } = await t().from("messages").insert({
        family_id: a.actor.familyId, child_id: a.actor.userId, problem_id: a.problemId, role: "child",
        content: a.text, client_msg_id: a.clientMsgId, created_by: a.actor.userId,
      }).select("id").single();
      if (error?.code === UNIQUE_VIOLATION) return { conflict: true };
      if (error || !data) fail("insertChildMessage", error);
      return { messageId: data.id as string };
    },

    async deleteMessage(messageId) {
      // Only an unanswered child message is ever removed: it is the claim of a turn that never ran.
      const { error } = await t().from("messages").delete().eq("id", messageId).eq("role", "child");
      if (error) fail("deleteMessage", error);
    },

    async saveReply(a) {
      const nowIso = a.now.toISOString();
      const { data: msg, error } = await t().from("messages").insert({
        family_id: a.actor.familyId, child_id: a.actor.userId, problem_id: a.problem.id, role: "tutor",
        content: a.tutorText, buttons: a.buttons, hint_level: a.problem.hintLevel, created_by: a.actor.userId,
      }).select(MESSAGE_COLS).single<MessageDb>();
      if (error || !msg) fail("saveReply.message", error);

      const { error: e2 } = await t().from("model_calls").insert({
        family_id: a.actor.familyId, child_id: a.actor.userId, message_id: msg.id, problem_id: a.problem.id, purpose: "tutor",
        model: a.model, prompt_version: a.promptVersion, raw_output: a.rawOutput,
        tokens_in: a.tokens.in, tokens_cached: a.tokens.cached, tokens_out: a.tokens.out, cost_usd: a.costUsd,
      });
      if (e2) fail("saveReply.model_call", e2);

      const { data: p, error: e3 } = await t().from("problems").update({
        turn_count: a.turn, status: a.status, statement_confirmed: a.statementConfirmed, updated_at: nowIso,
        closed_at: a.status === "in_progress" ? null : nowIso,
      }).eq("id", a.problem.id).select("id, status, turn_count").single();
      if (e3 || !p) fail("saveReply.problem", e3);

      const { error: e4 } = await t().from("study_sessions").update({ last_seen_at: nowIso, updated_at: nowIso }).eq("id", a.problem.sessionId);
      if (e4) fail("saveReply.session", e4);

      await addUsage(db, a.actor.familyId, a.now, a.costUsd);
      return replyFrom(p as ProblemDb, msg);
    },
  };
}

/**
 * Adds to the family's monthly spend (UTC month, like the Anthropic Console).
 * TODO(G7): read-then-write can lose a cent when both children send at the same instant; G7 moves
 * this into an SQL function in the study-launcher repo (the cap check also reads model_calls).
 */
async function addUsage(db: SupabaseClient, familyId: string, now: Date, cost: number) {
  const month = `${now.toISOString().slice(0, 7)}-01`;
  const t = db.schema("tutor");
  const { data, error } = await t.from("usage_monthly").select("cost_usd").eq("family_id", familyId).eq("month", month).maybeSingle();
  if (error) fail("usage.read", error);
  const next = Number(data?.cost_usd ?? 0) + cost;
  const { error: e2 } = await t.from("usage_monthly").upsert(
    { family_id: familyId, month, cost_usd: next.toFixed(6), updated_at: now.toISOString() },
    { onConflict: "family_id,month" },
  );
  if (e2) fail("usage.write", e2);
}

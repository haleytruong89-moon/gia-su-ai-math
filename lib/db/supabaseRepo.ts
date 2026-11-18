import "server-only";
// lib/db/supabaseRepo.ts — TutorRepo on schema `tutor` (SQL lives in the study-launcher repo,
// migration 0017). Service role: every call site has already checked the actor from the session.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImageData } from "@/lib/tutor/assemble";
import { createAdminClient } from "@/lib/supabase/admin";
import { BTN_SAVE } from "@/lib/copy";
import type { InputKind } from "@/lib/rules/events";
import type { HintLevel } from "@/lib/rules/hints";
import { deleteAfterVn } from "@/lib/rules/photo";
import { syncAttention } from "@/lib/report/attentionSync";
import { bridgeTurnsOf, checklistOf, flagsOf, usableSibling, type FoundMessage, type HistoryItem, type ProblemRow, type ProblemStatus, type StoredReply, type StuckKind, type TutorRepo } from "@/lib/tutor/repo";

const UNIQUE_VIOLATION = "23505";

function fail(where: string, error: { message: string } | null): never {
  throw new Error(`${where}: ${error?.message ?? "no row"}`);
}

interface ProblemDb {
  id: string; child_id: string; family_id: string; session_id: string; status: ProblemStatus; turn_count: number;
  hint_level: HintLevel; hint_level_max: HintLevel; nan_jumps: number; wrong_count: number; offtopic_count: number; u_level: 0 | 1 | 2 | 3;
  stuck_kind: StuckKind | null; statement_confirmed: boolean; confirmed_statement: string | null;
  ku_code: string | null; exam_slot: string | null; prereq_gaps: string[] | null;
}
interface MessageDb { id: string; role: "child" | "tutor" | "system"; content: string; buttons: string[] | null;
  hint_level: number | null; client_msg_id: string | null; created_at: string; problem_id: string; input_kind: InputKind }

// offtopic_count and input_kind come from Launcher migration 0018 (G2).
const PROBLEM_COLS = "id, child_id, family_id, session_id, status, turn_count, hint_level, hint_level_max, nan_jumps, wrong_count, " +
  "offtopic_count, u_level, stuck_kind, statement_confirmed, confirmed_statement, ku_code, exam_slot, prereq_gaps";
const MESSAGE_COLS = "id, role, content, buttons, hint_level, client_msg_id, created_at, problem_id, input_kind";

const BUCKET = "tutor-images"; // private, server only (Launcher 0019)
const SIGNED_URL_SECONDS = 600;
const REPLY_COLS = "id, status, turn_count, statement_confirmed";

function replyFrom(p: Pick<ProblemDb, "id" | "status" | "turn_count" | "statement_confirmed">, m: MessageDb): StoredReply {
  return { problemId: p.id, message: m.content, buttons: m.buttons ?? [], hintLevel: m.hint_level ?? 0, status: p.status, turnCount: p.turn_count,
    statementConfirmed: p.statement_confirmed };
}

export function supabaseRepo(db: SupabaseClient = createAdminClient(), strongModel = "claude-opus-5-5"): TutorRepo {
  const t = () => db.schema("tutor");

  return {
    async openSession(a) {
      // No deleted_at filter: the unique index study_sessions_one_active_uidx ignores it too.
      const { data: active, error } = await t().from("study_sessions").select("id, date_vn")
        .eq("child_id", a.actor.userId).eq("status", "active").maybeSingle();
      if (error) fail("openSession.read", error);
      if (active && active.date_vn === a.dateVn) return { id: active.id as string, reused: true };
      if (active) {
        // An active session left from an earlier day (DOMAIN §3.1): close it before opening today's.
        const at = new Date().toISOString();
        const { error: e0 } = await t().from("problems").update({ status: "abandoned", closed_at: at, updated_at: at })
          .eq("session_id", active.id).eq("status", "in_progress");
        if (e0) fail("openSession.abandonProblems", e0);
        const { error: e } = await t().from("study_sessions").update({ status: "abandoned", ended_at: at, updated_at: at }).eq("id", active.id);
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

    async setClassification(problemId, c) {
      const { error } = await t().from("problems").update({ ku_code: c.kuCode, exam_slot: c.examSlot, knowledge_version: c.knowledgeVersion,
        updated_at: new Date().toISOString() }).eq("id", problemId);
      if (error) fail("setClassification", error);
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
      const list = (rows ?? []) as (MessageDb & { role: "child" | "tutor" })[];
      const last = list.at(-1);
      const answered = last?.role === "child" ? list.slice(0, -1) : list;
      const history: HistoryItem[] = answered.map((m) => ({ id: m.id, role: m.role === "child" ? "user" : "assistant", content: m.content }));

      const { count: strongCalls, error: e3 } = await t().from("model_calls").select("id", { count: "exact", head: true })
        .eq("problem_id", p.id).eq("purpose", "tutor").eq("model", strongModel);
      if (e3) fail("getProblem.strong", e3);
      // The answers the child saw (message_id set), newest first: flags of the last one, checklist items of all.
      const { data: shownCalls, error: e4 } = await t().from("model_calls").select("id, raw_output")
        .eq("problem_id", p.id).eq("purpose", "tutor").not("message_id", "is", null)
        .order("created_at", { ascending: false }).returns<{ id: string; raw_output: string }[]>();
      if (e4) fail("getProblem.shownCalls", e4);
      const shown = shownCalls ?? [];
      const { data: siblings, error: e6 } = await t().from("tool_calls").select("model_call_id, ok, output")
        .eq("problem_id", p.id).eq("tool", "make_sibling").eq("ok", true);
      if (e6) fail("getProblem.siblings", e6);
      const shownIds = new Set(shown.map((c) => c.id));
      const { count: photos, error: e5 } = await t().from("attachments").select("id", { count: "exact", head: true }).eq("problem_id", p.id);
      if (e5) fail("getProblem.photos", e5);

      const row: ProblemRow = {
        id: p.id, childId: p.child_id, familyId: p.family_id, sessionId: p.session_id, status: p.status, turnCount: p.turn_count,
        hintLevel: p.hint_level, hintLevelMax: p.hint_level_max, nanJumps: p.nan_jumps, wrongCount: p.wrong_count,
        offtopicCount: p.offtopic_count, uLevel: p.u_level, stuckKind: p.stuck_kind, statementConfirmed: p.statement_confirmed,
        confirmedStatement: p.confirmed_statement, history, imageCount: photos ?? 0,
        thread: list.map((m) => ({ id: m.id, role: m.role, content: m.content, inputKind: m.input_kind })),
        statement: list.find((m) => m.role === "child")?.content ?? null,
        usedStrong: (strongCalls ?? 0) > 0,
        lastTutorFlags: shown[0] ? flagsOf(shown[0].raw_output) : [],
        siblingShown: (siblings ?? []).some((x) => shownIds.has(x.model_call_id as string) && usableSibling(x.output)),
        checklistAsked: [...new Set(shown.flatMap((c) => checklistOf(c.raw_output)))],
        kuCode: p.ku_code, examSlot: p.exam_slot, prereqGaps: p.prereq_gaps ?? [],
        bridgeTurns: bridgeTurnsOf(shown.map((c) => c.raw_output)),
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
        const { data: p, error: e3 } = await t().from("problems").select(REPLY_COLS).eq("id", m.problem_id).single();
        if (e3 || !p) fail("findByClientMsg.problem", e3);
        reply = replyFrom(p as ProblemDb, next);
      }
      return { problemId: m.problem_id, messageId: m.id, text: m.content, at: new Date(m.created_at), reply };
    },

    async insertChildMessage(a) {
      // created_at is the database clock, so the tutor reply (inserted later) always sorts after it.
      const { data, error } = await t().from("messages").insert({
        family_id: a.actor.familyId, child_id: a.actor.userId, problem_id: a.problemId, role: "child",
        content: a.text, client_msg_id: a.clientMsgId, input_kind: a.inputKind, created_by: a.actor.userId,
      }).select("id").single();
      if (error?.code === UNIQUE_VIOLATION) return { conflict: true };
      if (error || !data) fail("insertChildMessage", error);
      return { messageId: data.id as string };
    },

    async deleteMessage(messageId) {
      // Its photos: files first (the attachments rows go with the message, on delete cascade).
      const { data: att, error: e0 } = await t().from("attachments").select("storage_path").eq("message_id", messageId);
      if (e0) fail("deleteMessage.photos", e0);
      if (att?.length) {
        const { error: e1 } = await db.storage.from(BUCKET).remove(att.map((x) => x.storage_path as string));
        if (e1) fail("deleteMessage.files", e1);
      }
      // Only an unanswered child message is ever removed: it is the claim of a turn that never ran.
      const { error } = await t().from("messages").delete().eq("id", messageId).eq("role", "child");
      if (error) fail("deleteMessage", error);
    },

    async saveReply(a) {
      const nowIso = a.now.toISOString();
      // Every model call was paid for whatever happens next: count them first.
      await addUsage(db, a.actor.familyId, a.now, a.calls.reduce((sum, c) => sum + c.costUsd, 0));

      // Optimistic lock: only the turn that read turn_count = N may write N+1 (two devices, DOMAIN §5).
      const { data: p, error: e1 } = await t().from("problems").update({
        turn_count: a.turn, status: a.status, statement_confirmed: a.statementConfirmed, hint_level: a.hintLevel,
        ...(a.problem.confirmedStatement === null && a.confirmedStatement ? { confirmed_statement: a.confirmedStatement } : {}),
        hint_level_max: a.hintLevelMax, nan_jumps: a.nanJumps, wrong_count: a.wrongCount, offtopic_count: a.offtopicCount,
        u_level: a.uLevel, ku_code: a.kuCode, prereq_gaps: a.prereqGaps,
        updated_at: nowIso, closed_at: a.status === "in_progress" ? null : nowIso,
      }).eq("id", a.problem.id).eq("turn_count", a.problem.turnCount).select(REPLY_COLS).maybeSingle();
      if (e1) fail("saveReply.problem", e1);

      const { data: msg, error: e2 } = p
        ? await t().from("messages").insert({
            family_id: a.actor.familyId, child_id: a.actor.userId, problem_id: a.problem.id, role: "tutor",
            content: a.tutorText, buttons: a.buttons, hint_level: a.replyHintLevel, created_by: a.actor.userId,
          }).select(MESSAGE_COLS).single<MessageDb>()
        : { data: null, error: null };
      if (e2) fail("saveReply.message", e2);

      if (a.calls.length) {
        const { data: inserted, error: e3 } = await t().from("model_calls").insert(a.calls.map((c) => ({
          family_id: a.actor.familyId, child_id: a.actor.userId, message_id: c.shown ? (msg?.id ?? null) : null,
          problem_id: a.problem.id, purpose: c.purpose, model: c.model, prompt_version: a.promptVersion, raw_output: c.raw,
          tokens_in: c.tokens.in, tokens_cached: c.tokens.cached, tokens_out: c.tokens.out, cost_usd: c.costUsd,
          route_reason: c.routeReason, guard_result: c.guardResult, guard_reasons: c.guardReasons,
        }))).select("id");
        if (e3) fail("saveReply.model_calls", e3);
        const ids = (inserted ?? []).map((r) => r.id as string);
        if (a.tools.length) {
          const { error: e5 } = await t().from("tool_calls").insert(a.tools.map((tr) => ({
            family_id: a.actor.familyId, child_id: a.actor.userId, problem_id: a.problem.id, model_call_id: ids[tr.callIndex] ?? null,
            tool: tr.tool, input: tr.input ?? {}, output: tr.output ?? null, ok: tr.ok, ms: tr.ms,
          })));
          if (e5) fail("saveReply.tool_calls", e5);
        }
      }
      if (!p || !msg) return { conflict: true as const };
      if (a.diagnoses.length) {
        const { error: e6 } = await t().from("diagnoses").insert(a.diagnoses.map((dg) => ({
          family_id: a.actor.familyId, child_id: a.actor.userId, problem_id: a.problem.id, root: dg.root, source: dg.source, ku_code: dg.kuCode,
        })));
        if (e6) fail("saveReply.diagnoses", e6);
      }

      const { error: e4 } = await t().from("study_sessions").update({ last_seen_at: nowIso, updated_at: nowIso }).eq("id", a.problem.sessionId);
      if (e4) fail("saveReply.session", e4);
      return replyFrom(p as ProblemDb, msg);
    },

    async saveImage(a) {
      const path = `${a.actor.userId}/${a.problemId}/${crypto.randomUUID()}.jpg`;
      const { error } = await db.storage.from(BUCKET).upload(path, a.jpeg, { contentType: "image/jpeg", upsert: false });
      if (error) fail("saveImage.upload", error);
      const { error: e2 } = await t().from("attachments").insert({
        family_id: a.actor.familyId, child_id: a.actor.userId, problem_id: a.problemId, message_id: a.messageId, storage_path: path,
        width: a.width, height: a.height, bytes: a.jpeg.byteLength, source_device: a.device, delete_after: deleteAfterVn(a.now),
      });
      if (e2) {
        await db.storage.from(BUCKET).remove([path]); // no file without its row
        fail("saveImage.row", e2);
      }
    },

    async problemImages(problemId) {
      const { data, error } = await t().from("attachments").select("message_id, storage_path")
        .eq("problem_id", problemId).is("file_deleted_at", null).not("message_id", "is", null).order("created_at", { ascending: true });
      if (error) fail("problemImages", error);
      const out: { messageId: string; image: ImageData }[] = [];
      for (const row of data ?? []) {
        const { data: file, error: e2 } = await db.storage.from(BUCKET).download(row.storage_path as string);
        if (e2 || !file) fail("problemImages.download", e2);
        out.push({ messageId: row.message_id as string, image: { mediaType: "image/jpeg", data: Buffer.from(await file.arrayBuffer()).toString("base64") } });
      }
      return out;
    },

    async abandonUnconfirmed(problemId, childId, now) {
      if (!/^[0-9a-f-]{36}$/i.test(problemId)) return false;
      const at = now.toISOString();
      const { data, error } = await t().from("problems").update({ status: "abandoned", closed_at: at, updated_at: at })
        .eq("id", problemId).eq("child_id", childId).eq("status", "in_progress").eq("statement_confirmed", false).select("id");
      if (error) fail("abandonUnconfirmed", error);
      return (data?.length ?? 0) > 0;
    },

    async monthUsage(familyId, now) {
      const { data, error } = await t().from("usage_monthly").select("cost_usd, model_mode")
        .eq("family_id", familyId).eq("month", monthOf(now)).maybeSingle();
      if (error) fail("monthUsage", error);
      return { costUsd: Number(data?.cost_usd ?? 0), mode: data?.model_mode === "economy" ? "economy" : "normal" };
    },

    async pauseStrong(familyId, now) {
      const { data, error } = await t().from("usage_monthly").update({ model_mode: "economy", updated_at: now.toISOString() })
        .eq("family_id", familyId).eq("month", monthOf(now)).select("family_id");
      if (error) fail("pauseStrong", error);
      if (data?.length) return;
      const { error: e2 } = await t().from("usage_monthly")
        .upsert({ family_id: familyId, month: monthOf(now), model_mode: "economy", updated_at: now.toISOString() }, { onConflict: "family_id,month" });
      if (e2) fail("pauseStrong.insert", e2);
    },

    async saveForLater(a) {
      // The press is a child message first (client id is unique), so a resend of it is "already".
      const { data: m, error } = await t().from("messages").insert({
        family_id: a.actor.familyId, child_id: a.actor.userId, problem_id: a.problemId, role: "child",
        content: BTN_SAVE, client_msg_id: a.clientMsgId, input_kind: "button", created_by: a.actor.userId,
      }).select("id").single();
      if (error?.code === UNIQUE_VIOLATION) return "already";
      if (error || !m) fail("saveForLater.message", error);
      const at = a.now.toISOString();
      const { data: p, error: e2 } = await t().from("problems").update({ status: "saved_for_later", closed_at: at, updated_at: at })
        .eq("id", a.problemId).eq("child_id", a.actor.userId).eq("status", "in_progress").select("id").maybeSingle();
      if (e2) fail("saveForLater.problem", e2);
      if (p) return "saved";
      await this.deleteMessage(m.id as string); // the problem was already closed: leave no stray press
      return "not_open";
    },

    async syncAttention(a) {
      await syncAttention(db, a.familyId, a.childId, a.dateVn, a.now);
    },
  };
}

const monthOf = (now: Date) => `${now.toISOString().slice(0, 7)}-01`;

/**
 * Adds to the family's monthly spend (UTC month, like the Anthropic Console).
 * TODO(G7): read-then-write can lose a cent when both children send at the same instant; G7 moves
 * this into an SQL function in the study-launcher repo (the cap check also reads model_calls).
 */
async function addUsage(db: SupabaseClient, familyId: string, now: Date, cost: number) {
  const month = monthOf(now);
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

export interface ThreadMessage { id: string; role: "child" | "tutor"; text: string; buttons: string[]; images: string[] }
export interface Thread {
  problemId: string; status: ProblemStatus; turnCount: number; statementConfirmed: boolean; hasImages: boolean; messages: ThreadMessage[];
}

/** The chat of one problem for the child's screen; null when it is not this child's. Photos as 10-minute signed URLs. */
export async function problemThread(problemId: string, childId: string, db: SupabaseClient = createAdminClient()): Promise<Thread | null> {
  if (!/^[0-9a-f-]{36}$/i.test(problemId)) return null;
  const t = db.schema("tutor");
  const { data: p, error } = await t.from("problems").select(REPLY_COLS)
    .eq("id", problemId).eq("child_id", childId).is("deleted_at", null).maybeSingle();
  if (error) fail("problemThread", error);
  if (!p) return null;
  const { data: rows, error: e2 } = await t.from("messages").select(MESSAGE_COLS)
    .eq("problem_id", problemId).is("deleted_at", null).neq("role", "system").order("created_at", { ascending: true }).returns<MessageDb[]>();
  if (e2) fail("problemThread.messages", e2);
  const { data: att, error: e3 } = await t.from("attachments").select("message_id, storage_path")
    .eq("problem_id", problemId).is("file_deleted_at", null).order("created_at", { ascending: true });
  if (e3) fail("problemThread.photos", e3);
  const byMessage = new Map<string, string[]>();
  if (att?.length) {
    const { data: urls, error: e4 } = await db.storage.from(BUCKET).createSignedUrls(att.map((a) => a.storage_path as string), SIGNED_URL_SECONDS);
    if (e4) fail("problemThread.urls", e4);
    att.forEach((a, i) => {
      const url = urls?.[i]?.signedUrl;
      if (url && a.message_id) byMessage.set(a.message_id as string, [...(byMessage.get(a.message_id as string) ?? []), url]);
    });
  }
  return {
    problemId, status: p.status as ProblemStatus, turnCount: p.turn_count as number,
    statementConfirmed: p.statement_confirmed as boolean, hasImages: (att?.length ?? 0) > 0,
    messages: (rows ?? []).map((m) => ({ id: m.id, role: m.role === "child" ? "child" : "tutor", text: m.content, buttons: m.buttons ?? [],
      images: byMessage.get(m.id) ?? [] })),
  };
}

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
import { maxImagesFor } from "@/lib/rules/photoLimit";
import { syncAttention } from "@/lib/report/attentionSync";
import { activeRules, type RuleRow } from "@/lib/rules/teachingRules";
import { reopenAfterMistake } from "@/lib/rules/review";
import { bridgeTurnsOf, checklistOf, flagsOf, RATING_EDIT_MS, RATING_OUTCOMES, usableSibling, type FoundMessage, type HistoryItem, type ProblemRow, type ProblemStatus, type StoredReply, type StoredReviewItem, type StuckKind, type TutorRepo } from "@/lib/tutor/repo";

const UNIQUE_VIOLATION = "23505";

// card_code / item_key come from Launcher migration 0024 (G6). Server only: `answer` never goes to a browser.
const REVIEW_COLS = "id, ku_code, card_code, kind, prompt, buttons, answer, answer_check, box, due_date_vn, correct_streak, status";
interface ReviewDb { id: string; ku_code: string; card_code: string | null; kind: StoredReviewItem["kind"]; prompt: string; buttons: unknown;
  answer: string; answer_check: "exact" | "math_check"; box: 1 | 2 | 3 | 4; due_date_vn: string; correct_streak: number;
  status: StoredReviewItem["status"] }
const reviewFrom = (r: ReviewDb): StoredReviewItem => ({ id: r.id, kuCode: r.ku_code, cardCode: r.card_code, kind: r.kind, prompt: r.prompt,
  buttons: Array.isArray(r.buttons) ? r.buttons.filter((b): b is string => typeof b === "string") : [], answer: r.answer,
  answerCheck: r.answer_check, box: r.box, dueDateVn: r.due_date_vn, correctStreak: r.correct_streak, status: r.status });

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
  hint_level: number | null; client_msg_id: string | null; created_at: string; problem_id: string; input_kind: InputKind;
  card_ref: string | null }

// offtopic_count and input_kind come from Launcher migration 0018 (G2).
const PROBLEM_COLS = "id, child_id, family_id, session_id, status, turn_count, hint_level, hint_level_max, nan_jumps, wrong_count, " +
  "offtopic_count, u_level, stuck_kind, statement_confirmed, confirmed_statement, ku_code, exam_slot, prereq_gaps";
// card_ref comes from Launcher migration 0024 (G6).
const MESSAGE_COLS = "id, role, content, buttons, hint_level, client_msg_id, created_at, problem_id, input_kind, card_ref";

const BUCKET = "tutor-images"; // private, server only (Launcher 0019)
const SIGNED_URL_SECONDS = 600;
const REPLY_COLS = "id, status, turn_count, statement_confirmed";

function replyFrom(p: Pick<ProblemDb, "id" | "status" | "turn_count" | "statement_confirmed">, m: MessageDb): StoredReply {
  return { problemId: p.id, message: m.content, buttons: m.buttons ?? [], hintLevel: m.hint_level ?? 0, status: p.status, turnCount: p.turn_count,
    statementConfirmed: p.statement_confirmed, cardRef: m.card_ref ?? null };
}

export function supabaseRepo(db: SupabaseClient = createAdminClient(), strongModel = "claude-opus-5-5"): TutorRepo {
  const t = () => db.schema("tutor");
  /** Updates this month's usage row of the family, creating it when the month has no spend yet. */
  async function setMonth(familyId: string, now: Date, cols: Record<string, string>) {
    const { data, error } = await t().from("usage_monthly").update({ ...cols, updated_at: now.toISOString() })
      .eq("family_id", familyId).eq("month", monthOf(now)).select("family_id");
    if (error) fail("usage.set", error);
    if (data?.length) return;
    const { error: e2 } = await t().from("usage_monthly")
      .upsert({ family_id: familyId, month: monthOf(now), ...cols, updated_at: now.toISOString() }, { onConflict: "family_id,month" });
    if (e2) fail("usage.set.insert", e2);
  }

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
        profile_version: a.actor.profileVersion, rules_version: a.rulesVersion, prompt_version: a.promptVersion, model_main: a.modelMain, created_by: a.actor.userId,
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
      const history: HistoryItem[] = answered.map((m) => ({ id: m.id, role: m.role === "child" ? "user" : "assistant", content: m.content,
        cardRef: m.card_ref ?? null }));

      const { count: strongCalls, error: e3 } = await t().from("model_calls").select("id", { count: "exact", head: true })
        .eq("problem_id", p.id).eq("purpose", "tutor").eq("model", strongModel)
        // D36: an Opus rewrite of a blocked answer does not make the problem stick to Opus; only real signals do.
        .or("route_reason.is.null,route_reason.neq.guard_blocked");
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
        thread: list.map((m) => ({ id: m.id, role: m.role, content: m.content, inputKind: m.input_kind, cardRef: m.card_ref ?? null })),
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
            content: a.tutorText, buttons: a.buttons, hint_level: a.replyHintLevel, card_ref: a.cardRef, created_by: a.actor.userId,
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

    async saveScriptedReply(a) {
      const nowIso = a.now.toISOString();
      const { data: msg, error } = await t().from("messages").insert({
        family_id: a.actor.familyId, child_id: a.actor.userId, problem_id: a.problem.id, role: "tutor",
        content: a.message, buttons: a.buttons, hint_level: a.problem.hintLevel, card_ref: a.cardRef, created_by: a.actor.userId,
      }).select(MESSAGE_COLS).single<MessageDb>();
      if (error || !msg) fail("saveScriptedReply.message", error);
      const { error: e2 } = await t().from("study_sessions").update({ last_seen_at: nowIso, updated_at: nowIso }).eq("id", a.problem.sessionId);
      if (e2) fail("saveScriptedReply.session", e2);
      return replyFrom({ id: a.problem.id, status: a.problem.status, turn_count: a.problem.turnCount,
        statement_confirmed: a.problem.statementConfirmed }, msg);
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
      const { data, error } = await t().from("usage_monthly")
        .select("cost_usd, model_mode, burn_alert_sent_at, economy_alert_sent_at, console_alert_sent_at")
        .eq("family_id", familyId).eq("month", monthOf(now)).maybeSingle();
      if (error) fail("monthUsage", error);
      const at = (v: unknown) => (typeof v === "string" ? new Date(v) : null);
      return { costUsd: Number(data?.cost_usd ?? 0), mode: data?.model_mode === "economy" ? "economy" : "normal",
        burnAlertSentAt: at(data?.burn_alert_sent_at), economyAlertSentAt: at(data?.economy_alert_sent_at), consoleAlertSentAt: at(data?.console_alert_sent_at) };
    },

    async pauseStrong(familyId, now) {
      await setMonth(familyId, now, { model_mode: "economy" });
    },

    async resumeStrong(familyId, now) {
      await setMonth(familyId, now, { model_mode: "normal" });
    },

    async saveReference(a) {
      if (a.call) {
        const { error } = await t().from("model_calls").insert({
          family_id: a.familyId, child_id: a.childId, problem_id: a.problemId, purpose: "reference", model: a.call.model,
          prompt_version: a.promptVersion, raw_output: a.call.raw, guard_result: a.reference?.verified ? "pass" : "blocked",
          tokens_in: a.call.tokens.in, tokens_cached: a.call.tokens.cached, tokens_out: a.call.tokens.out, cost_usd: a.call.costUsd,
        });
        if (error) fail("saveReference.call", error);
        await addUsage(db, a.familyId, a.now, a.call.costUsd);
      }
      if (!a.reference?.verified) return;
      const { error: e2 } = await t().from("reference_solutions").upsert({
        family_id: a.familyId, child_id: a.childId, problem_id: a.problemId, content: a.reference.steps.join("\n"), final_answer: a.reference.finalAnswer,
      }, { onConflict: "problem_id", ignoreDuplicates: true });
      if (e2) fail("saveReference.solution", e2);
    },

    async getReference(problemId, childId) {
      if (!/^[0-9a-f-]{36}$/i.test(problemId)) return null;
      const { data: p, error } = await t().from("problems").select("status").eq("id", problemId).eq("child_id", childId).is("deleted_at", null).maybeSingle();
      if (error) fail("getReference.problem", error);
      if (p?.status !== "self_solved") return null;
      const { data: r, error: e2 } = await t().from("reference_solutions").select("content, final_answer").eq("problem_id", problemId).eq("child_id", childId).maybeSingle();
      if (e2) fail("getReference", e2);
      return r ? { steps: String(r.content).split("\n"), finalAnswer: (r.final_answer as string | null) ?? "" } : null;
    },

    async markAlert(familyId, kind, now) {
      await setMonth(familyId, now, { [`${kind}_alert_sent_at`]: now.toISOString() });
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

    async childRules(childId) {
      const { data, error } = await t().from("teaching_rules").select("id, status, version, text, source_key")
        .eq("child_id", childId).is("deleted_at", null).order("created_at", { ascending: true });
      if (error) fail("childRules", error);
      return (data ?? []).map((r) => ({ id: r.id as string, status: r.status as RuleRow["status"], version: r.version as number,
        text: r.text as string, sourceKey: (r.source_key as string | null) ?? null }));
    },

    async rulesForSession(sessionId, childId) {
      const { data: s, error } = await t().from("study_sessions").select("rules_version")
        .eq("id", sessionId).eq("child_id", childId).maybeSingle();
      if (error) fail("rulesForSession", error);
      if (!s) return [];
      return activeRules(await this.childRules(childId), (s.rules_version as number | null) ?? 0);
    },

    async proposeRule(a) {
      const { error } = await t().from("teaching_rules").insert({
        family_id: a.familyId, child_id: a.childId, text: a.text, status: "proposed", version: 0, source: a.source,
        source_key: a.sourceKey, source_ids: a.sourceIds, created_at: a.now.toISOString(), updated_at: a.now.toISOString(),
      });
      if (error) fail("proposeRule", error);
    },

    async endSession(a) {
      const { data: s, error } = await t().from("study_sessions").select("id, status")
        .eq("id", a.sessionId).eq("child_id", a.actor.userId).is("deleted_at", null).maybeSingle();
      if (error) fail("endSession.read", error);
      if (!s) return "not_found";
      if (s.status !== "active") return "already";
      const at = a.now.toISOString();
      const { data: done, error: e2 } = await t().from("study_sessions").update({ status: "ended", ended_at: at, updated_at: at })
        .eq("id", a.sessionId).eq("status", "active").select("id");
      if (e2) fail("endSession.update", e2);
      if (!done?.length) return "already";
      const { error: e3 } = await t().from("problems").update({ status: "timed_out", closed_at: at, updated_at: at })
        .eq("session_id", a.sessionId).eq("status", "in_progress");
      if (e3) fail("endSession.problems", e3);
      return "ended";
    },

    async saveRating(a) {
      const { data: s, error } = await t().from("study_sessions").select("id")
        .eq("id", a.sessionId).eq("child_id", a.actor.userId).is("deleted_at", null).maybeSingle();
      if (error) fail("saveRating.session", error);
      if (!s) return "not_found";
      const { data: old, error: e2 } = await t().from("ratings").select("id, created_at").eq("session_id", a.sessionId).maybeSingle();
      if (e2) fail("saveRating.read", e2);
      if (old) {
        if (a.now.getTime() - new Date(old.created_at as string).getTime() > RATING_EDIT_MS) return "already";
        const { error: e3 } = await t().from("ratings").update({ face: a.face, reasons: a.reasons, comment: a.comment }).eq("id", old.id as string);
        if (e3) fail("saveRating.update", e3);
        return "updated";
      }
      const { error: e4 } = await t().from("ratings").insert({
        family_id: a.actor.familyId, child_id: a.actor.userId, session_id: a.sessionId, face: a.face, reasons: a.reasons, comment: a.comment,
        created_at: a.now.toISOString(),
      });
      if (e4?.code === UNIQUE_VIOLATION) return "already"; // two taps at once
      if (e4) fail("saveRating.insert", e4);
      return "saved";
    },

    async tutorMessageFor(childId, ref) {
      if (ref.kind === "id") {
        const { data, error } = await t().from("messages").select("id, problem_id")
          .eq("id", ref.id).eq("child_id", childId).eq("role", "tutor").is("deleted_at", null).maybeSingle();
        if (error) fail("tutorMessageFor.id", error);
        return data ? { id: data.id as string, problemId: data.problem_id as string } : null;
      }
      const { data: asked, error: e1 } = await t().from("messages").select("problem_id, created_at")
        .eq("child_id", childId).eq("client_msg_id", ref.clientMsgId).eq("role", "child").is("deleted_at", null).maybeSingle();
      if (e1) fail("tutorMessageFor.child", e1);
      if (!asked) return null;
      const { data, error: e2 } = await t().from("messages").select("id, problem_id")
        .eq("problem_id", asked.problem_id as string).eq("child_id", childId).eq("role", "tutor").is("deleted_at", null)
        .gte("created_at", asked.created_at as string).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (e2) fail("tutorMessageFor.reply", e2);
      return data ? { id: data.id as string, problemId: data.problem_id as string } : null;
    },

    async saveMessageFeedback(a) {
      const { error } = await t().from("message_feedback").insert({
        family_id: a.actor.familyId, child_id: a.actor.userId, problem_id: a.problemId, message_id: a.messageId,
        kind: a.kind, comment: a.comment, client_msg_id: a.clientMsgId, created_at: a.now.toISOString(), created_by: a.actor.userId,
      });
      if (error?.code === UNIQUE_VIOLATION) return "already";
      if (error) fail("saveMessageFeedback", error);
      return "saved";
    },

    async sessionRated(sessionId, childId) {
      const { count, error } = await t().from("ratings").select("id", { count: "exact", head: true }).eq("session_id", sessionId).eq("child_id", childId);
      if (error) fail("sessionRated", error);
      return (count ?? 0) > 0;
    },

    async latestRatings(childId, n) {
      const { data, error } = await t().from("ratings").select("id, face, reasons")
        .eq("child_id", childId).order("created_at", { ascending: false }).limit(n);
      if (error) fail("latestRatings", error);
      return (data ?? []).map((r) => ({ id: r.id as string, face: r.face as string, reasons: (r.reasons as string[] | null) ?? [] }));
    },

    async addReviewItems(a) {
      let added = 0;
      for (const it of a.items) {
        const { error } = await t().from("review_items").insert({
          family_id: a.actor.familyId, child_id: a.actor.userId, ku_code: it.kuCode, card_code: it.cardCode, item_key: it.itemKey,
          kind: it.kind, prompt: it.prompt, answer: it.answer, answer_check: it.answerCheck, buttons: it.buttons, box: it.box,
          due_date_vn: it.dueDateVn, status: it.status, source: it.source, created_by: a.actor.userId,
        });
        if (error?.code === UNIQUE_VIOLATION) continue; // already in the queue (review_items_card_uidx)
        if (error) fail("addReviewItems", error);
        added++;
      }
      return added;
    },

    async reopenReviews(a) {
      const { data, error } = await t().from("review_items").select(REVIEW_COLS).eq("child_id", a.childId).eq("ku_code", a.kuCode)
        .eq("status", "retired").is("deleted_at", null).returns<ReviewDb[]>();
      if (error) fail("reopenReviews.read", error);
      for (const r of data ?? []) {
        const n = reopenAfterMistake(reviewFrom(r), a.todayVn);
        const { error: e2 } = await t().from("review_items").update({ status: n.status, box: n.box, correct_streak: n.correctStreak,
          due_date_vn: n.dueDateVn, updated_at: a.now.toISOString() }).eq("id", r.id).eq("status", "retired");
        if (e2) fail("reopenReviews.update", e2);
      }
      return data?.length ?? 0;
    },

    async reviewItemsOf(childId) {
      const { data, error } = await t().from("review_items").select(REVIEW_COLS).eq("child_id", childId).eq("status", "active")
        .is("deleted_at", null).returns<ReviewDb[]>();
      if (error) fail("reviewItemsOf", error);
      return (data ?? []).map(reviewFrom);
    },

    async reviewItem(itemId, childId) {
      if (!/^[0-9a-f-]{36}$/i.test(itemId)) return null;
      const { data, error } = await t().from("review_items").select(REVIEW_COLS).eq("id", itemId).eq("child_id", childId)
        .is("deleted_at", null).maybeSingle<ReviewDb>();
      if (error) fail("reviewItem", error);
      return data ? reviewFrom(data) : null;
    },

    async reviewAttempt(childId, clientMsgId) {
      const { data, error } = await t().from("review_attempts").select("review_item_id, result").eq("child_id", childId)
        .eq("client_msg_id", clientMsgId).maybeSingle();
      if (error) fail("reviewAttempt", error);
      return data ? { itemId: data.review_item_id as string, result: data.result as "correct" | "wrong" | "skipped" } : null;
    },

    async saveReviewAnswer(a) {
      const { error } = await t().from("review_attempts").insert({ family_id: a.actor.familyId, child_id: a.actor.userId,
        review_item_id: a.item.id, answer: a.answer, result: a.result, client_msg_id: a.clientMsgId });
      if (error?.code === UNIQUE_VIOLATION) return "already";
      if (error) fail("saveReviewAnswer.attempt", error);
      const { error: e2 } = await t().from("review_items").update({ box: a.next.box, due_date_vn: a.next.dueDateVn,
        correct_streak: a.next.correctStreak, status: a.next.status, updated_at: a.now.toISOString() }).eq("id", a.item.id);
      if (e2) fail("saveReviewAnswer.item", e2);
      return "saved";
    },

    async ratingState(problemId, childId) {
      if (!/^[0-9a-f-]{36}$/i.test(problemId)) return null;
      const { data: p, error } = await t().from("problems").select("id, session_id")
        .eq("id", problemId).eq("child_id", childId).is("deleted_at", null).maybeSingle();
      if (error) fail("ratingState.problem", error);
      if (!p) return null;
      const [sess, siblings, rating] = await Promise.all([
        t().from("study_sessions").select("status").eq("id", p.session_id as string).maybeSingle(),
        t().from("problems").select("id, status, created_at").eq("session_id", p.session_id as string).is("deleted_at", null).order("created_at", { ascending: true }),
        t().from("ratings").select("id", { count: "exact", head: true }).eq("session_id", p.session_id as string),
      ]);
      if (sess.error) fail("ratingState.session", sess.error);
      if (siblings.error) fail("ratingState.problems", siblings.error);
      if (rating.error) fail("ratingState.rating", rating.error);
      const list = siblings.data ?? [];
      const mine = list.findIndex((x) => x.id === problemId);
      return {
        sessionId: p.session_id as string,
        sessionStatus: (sess.data?.status as "active" | "ended" | "abandoned" | undefined) ?? "active",
        rated: (rating.count ?? 0) > 0,
        earlierEnded: list.slice(0, Math.max(mine, 0)).some((x) => RATING_OUTCOMES.includes(x.status as ProblemStatus)),
      };
    },
  };
}

const monthOf = (now: Date) => `${now.toISOString().slice(0, 7)}-01`;

/**
 * Adds to the family's monthly spend (UTC month, like the Anthropic Console).
 */
export async function addUsage(db: SupabaseClient, familyId: string, now: Date, cost: number) {
  // Atomic (study-launcher 0023 tutor.add_usage): two children answering at the same instant both count.
  const { error } = await db.schema("tutor").rpc("add_usage", { p_family: familyId, p_month: monthOf(now), p_cost: cost });
  if (error) fail("usage.add", error);
}

export interface ThreadMessage { id: string; role: "child" | "tutor"; text: string; buttons: string[]; images: string[]; cardRef: string | null }
export interface Thread {
  problemId: string; status: ProblemStatus; turnCount: number; statementConfirmed: boolean; hasImages: boolean; messages: ThreadMessage[];
  /** G8-fix: photos allowed for this problem (6 for geometry lessons, else 4) — the server enforces the same number. */
  maxImages: number;
}

/** The chat of one problem for the child's screen; null when it is not this child's. Photos as 10-minute signed URLs. */
export async function problemThread(problemId: string, childId: string, db: SupabaseClient = createAdminClient()): Promise<Thread | null> {
  if (!/^[0-9a-f-]{36}$/i.test(problemId)) return null;
  const t = db.schema("tutor");
  const { data: p, error } = await t.from("problems").select(`${REPLY_COLS}, ku_code`)
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
    maxImages: maxImagesFor((p.ku_code as string | null) ?? null),
    messages: (rows ?? []).map((m) => ({ id: m.id, role: m.role === "child" ? "child" : "tutor", text: m.content, buttons: m.buttons ?? [],
      images: byMessage.get(m.id) ?? [], cardRef: m.card_ref ?? null })),
  };
}

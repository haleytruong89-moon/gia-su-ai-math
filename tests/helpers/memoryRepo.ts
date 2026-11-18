// In-memory TutorRepo for the handler tests. Same contract as lib/db/supabaseRepo.ts.
import { BTN_SAVE } from "@/lib/copy";
import { deleteAfterVn } from "@/lib/rules/photo";
import type { HintLevel } from "@/lib/rules/hints";
import type { InputKind } from "@/lib/rules/events";
import {
  bridgeTurnsOf, checklistOf, flagsOf, usableSibling, type Diagnosis, type FoundMessage, type HistoryItem, type ModelCallRecord, type ProblemRow, type ProblemStatus, type SaveReplyInput, type StoredReply,
  type StuckKind, type TutorRepo, RATING_EDIT_MS, RATING_OUTCOMES,
} from "@/lib/tutor/repo";
import { activeRules, type RuleRow } from "@/lib/rules/teachingRules";

interface Sess { id: string; childId: string; dateVn: string; status: "active" | "ended" | "abandoned"; device: string; rulesVersion: number }
interface RuleMem extends RuleRow { childId: string; familyId: string; source: string; sourceIds: string[] }
interface RatingMem { id: string; sessionId: string; childId: string; face: "easy" | "ok" | "hard"; reasons: string[]; comment: string | null; at: Date }
interface Prob { id: string; childId: string; familyId: string; sessionId: string; status: ProblemStatus; turnCount: number;
  hintLevel: HintLevel; hintLevelMax: HintLevel; nanJumps: number; wrongCount: number; offtopicCount: number; uLevel: 0 | 1 | 2 | 3;
  stuckKind: StuckKind | null; statementConfirmed: boolean; confirmedStatement: string | null;
  kuCode: string | null; examSlot: string | null; prereqGaps: string[]; knowledgeVersion: string | null }
interface ImageRow { id: string; problemId: string; messageId: string; childId: string; path: string; data: string; width: number;
  height: number; deleteAfter: string }
interface MsgRow { id: string; childId: string; problemId: string; role: "child" | "tutor"; text: string; buttons: string[];
  inputKind: InputKind; hintLevel: number | null; clientMsgId: string | null; at: Date; reply?: StoredReply }
type ToolRow = { problemId: string; tool: string; input: unknown; output: unknown; ok: boolean; ms: number; callRow: number };
type CallRow = ModelCallRecord & { problemId: string; childMessageId: string; tutorMessageId: string | null; promptVersion: string };

export interface Seed {
  sessions?: Partial<Sess>[];
  problems?: (Partial<Prob> & { id: string; childId: string })[];
  messages?: (Partial<MsgRow> & { problemId: string; role: "child" | "tutor"; text: string })[];
  /** earlier model calls (e.g. a strong-model call, or the flags of the last answer) */
  calls?: (Partial<CallRow> & { problemId: string })[];
  usage?: { familyId?: string; month: string; costUsd: number; mode?: "normal" | "economy" }[];
  images?: (Partial<ImageRow> & { problemId: string; messageId: string })[];
  rules?: (Partial<RuleMem> & { id: string })[];
  ratings?: (Partial<RatingMem> & { sessionId: string })[];
}

export function memoryRepo(seed: Seed = {}, strongModel = "claude-opus-5-5") {
  let n = 0;
  const id = (p: string) => `${p}${++n}`;
  const sessions: Sess[] = (seed.sessions ?? []).map((s) => ({ id: id("s"), childId: "c1", dateVn: "2026-11-14", status: "active", device: "laptop", rulesVersion: 0, ...s }));
  const rules: RuleMem[] = (seed.rules ?? []).map((r) => ({ childId: "c1", familyId: "f1", status: "approved", version: 1, text: "Luật", sourceKey: null,
    source: "manual", sourceIds: [], ...r }));
  const ratings: RatingMem[] = (seed.ratings ?? []).map((r) => ({ id: id("r"), childId: "c1", face: "ok", reasons: [], comment: null,
    at: new Date("2026-11-13T10:00:00Z"), ...r }));
  const problems: Prob[] = (seed.problems ?? []).map((p) => ({ familyId: "f1", sessionId: "s0", status: "in_progress", turnCount: 0,
    hintLevel: 0, hintLevelMax: 0, nanJumps: 0, wrongCount: 0, offtopicCount: 0, uLevel: 0, stuckKind: null, statementConfirmed: false,
    confirmedStatement: null, kuCode: null, examSlot: null, prereqGaps: [], knowledgeVersion: null, ...p }));
  const messages: MsgRow[] = (seed.messages ?? []).map((m) => ({ id: id("m"), childId: "c1", buttons: [], clientMsgId: null,
    inputKind: "text", hintLevel: null, at: new Date("2026-11-14T10:00:00Z"), ...m }));
  const modelCalls: CallRow[] = (seed.calls ?? []).map((c) => ({ purpose: "tutor", model: "claude-sonnet-5-5", raw: "{}", costUsd: 0,
    tokens: { in: 0, cached: 0, out: 0 }, routeReason: null, guardResult: null, guardReasons: [], shown: true, childMessageId: "",
    tutorMessageId: "", promptVersion: "test", ...c }));
  const images: ImageRow[] = (seed.images ?? []).map((i) => ({ id: id("i"), childId: "c1", path: "c1/x/y.jpg", data: "QUJD",
    width: 10, height: 10, deleteAfter: "2027-01-01", ...i }));
  const toolCalls: ToolRow[] = [];
  /** G7: every syncAttention call (the real repo rewrites public.learning_attention). */
  const attentionSyncs: { familyId: string; childId: string; dateVn: string }[] = [];
  const failAttention = { on: false };
  const diagnoses: (Diagnosis & { problemId: string; childId: string })[] = [];
  const usage = new Map<string, number>();
  const modes = new Map<string, "normal" | "economy">();
  for (const u of seed.usage ?? []) {
    usage.set(`${u.familyId ?? "f1"}|${u.month}`, u.costUsd);
    if (u.mode) modes.set(`${u.familyId ?? "f1"}|${u.month}`, u.mode);
  }
  /** G7c: money pushes sent, by "family|month|kind". */
  const alerts = new Map<string, Date>();
  const monthKey = (familyId: string, now: Date) => `${familyId}|${now.toISOString().slice(0, 7)}-01`;

  const replyAfter = (m: MsgRow): StoredReply | null => {
    const list = messages.filter((x) => x.problemId === m.problemId);
    const next = list[list.indexOf(m) + 1];
    return next?.role === "tutor" ? (next.reply ?? null) : null;
  };

  const repo: TutorRepo = {
    async openSession(a) {
      const active = sessions.find((s) => s.childId === a.actor.userId && s.status === "active");
      if (active && active.dateVn === a.dateVn) return { id: active.id, reused: true };
      if (active) {
        active.status = "abandoned";
        for (const p of problems) if (p.sessionId === active.id && p.status === "in_progress") p.status = "abandoned";
      }
      const s: Sess = { id: id("s"), childId: a.actor.userId, dateVn: a.dateVn, status: "active", device: a.device, rulesVersion: a.rulesVersion };
      sessions.push(s);
      return { id: s.id, reused: false };
    },
    async createProblem(a) {
      const p: Prob = { id: id("p"), childId: a.actor.userId, familyId: a.actor.familyId, sessionId: a.sessionId, status: "in_progress",
        turnCount: 0, hintLevel: 0, hintLevelMax: 0, nanJumps: 0, wrongCount: 0, offtopicCount: 0, uLevel: 0, stuckKind: a.stuckKind,
        statementConfirmed: false, confirmedStatement: null, kuCode: null, examSlot: null, prereqGaps: [], knowledgeVersion: null };
      problems.push(p);
      return { id: p.id };
    },
    async setProblemStatus(problemId, status) {
      const p = problems.find((x) => x.id === problemId);
      if (p) p.status = status;
    },
    async setClassification(problemId, c) {
      const p = problems.find((x) => x.id === problemId);
      if (p) Object.assign(p, { kuCode: c.kuCode, examSlot: c.examSlot, knowledgeVersion: c.knowledgeVersion });
    },
    async getProblemForChild(problemId, childId) {
      const p = problems.find((x) => x.id === problemId && x.childId === childId);
      if (!p) return null;
      const list = messages.filter((m) => m.problemId === p.id);
      const last = list[list.length - 1];
      const answered = last?.role === "child" ? list.slice(0, -1) : list;
      const history: HistoryItem[] = answered.map((m) => ({ id: m.id, role: m.role === "child" ? "user" : "assistant", content: m.text }));
      const pending = last?.role === "child" ? { messageId: last.id, clientMsgId: last.clientMsgId, text: last.text, at: last.at } : null;
      const calls = modelCalls.filter((c) => c.problemId === p.id);
      const lastShown = calls.filter((c) => c.purpose === "tutor" && c.shown).at(-1);
      const row: ProblemRow = {
        id: p.id, childId: p.childId, familyId: p.familyId, sessionId: p.sessionId, status: p.status, turnCount: p.turnCount,
        hintLevel: p.hintLevel, hintLevelMax: p.hintLevelMax, nanJumps: p.nanJumps, wrongCount: p.wrongCount,
        offtopicCount: p.offtopicCount, uLevel: p.uLevel, stuckKind: p.stuckKind, statementConfirmed: p.statementConfirmed,
        confirmedStatement: p.confirmedStatement, history, imageCount: images.filter((i) => i.problemId === p.id).length,
        thread: list.map((m) => ({ id: m.id, role: m.role, content: m.text, inputKind: m.inputKind })),
        statement: list.find((m) => m.role === "child")?.text ?? null,
        usedStrong: calls.some((c) => c.purpose === "tutor" && c.model === strongModel),
        lastTutorFlags: lastShown ? flagsOf(lastShown.raw) : [],
        siblingShown: toolCalls.some((t) => t.problemId === p.id && t.tool === "make_sibling" && t.ok && usableSibling(t.output)
          && modelCalls[t.callRow]?.shown === true),
        checklistAsked: [...new Set(calls.filter((c) => c.purpose === "tutor" && c.shown).flatMap((c) => checklistOf(c.raw)))],
        kuCode: p.kuCode, examSlot: p.examSlot, prereqGaps: [...p.prereqGaps],
        bridgeTurns: bridgeTurnsOf(calls.filter((c) => c.purpose === "tutor" && c.shown).map((c) => c.raw).reverse()),
        pending,
      };
      return row;
    },
    async findByClientMsg(childId, clientMsgId): Promise<FoundMessage | null> {
      const m = messages.find((x) => x.childId === childId && x.clientMsgId === clientMsgId);
      return m ? { problemId: m.problemId, messageId: m.id, text: m.text, at: m.at, reply: replyAfter(m) } : null;
    },
    async insertChildMessage(a) {
      if (messages.some((m) => m.childId === a.actor.userId && m.clientMsgId === a.clientMsgId)) return { conflict: true };
      const m: MsgRow = { id: id("m"), childId: a.actor.userId, problemId: a.problemId, role: "child", text: a.text, buttons: [],
        inputKind: a.inputKind, hintLevel: null, clientMsgId: a.clientMsgId, at: a.now };
      messages.push(m);
      return { messageId: m.id };
    },
    async deleteMessage(messageId) {
      const i = messages.findIndex((m) => m.id === messageId);
      if (i >= 0) messages.splice(i, 1);
      for (let k = images.length - 1; k >= 0; k--) if (images[k]!.messageId === messageId) images.splice(k, 1);
    },
    async saveImage(a) {
      images.push({ id: id("i"), problemId: a.problemId, messageId: a.messageId, childId: a.actor.userId,
        path: `${a.actor.userId}/${a.problemId}/${id("f")}.jpg`, data: a.jpeg.toString("base64"), width: a.width, height: a.height,
        deleteAfter: deleteAfterVn(a.now) });
    },
    async problemImages(problemId) {
      return images.filter((i) => i.problemId === problemId).map((i) => ({ messageId: i.messageId, image: { mediaType: "image/jpeg" as const, data: i.data } }));
    },
    async abandonUnconfirmed(problemId, childId) {
      const p = problems.find((x) => x.id === problemId && x.childId === childId);
      if (!p || p.status !== "in_progress" || p.statementConfirmed) return false;
      p.status = "abandoned";
      return true;
    },
    async saveReply(a: SaveReplyInput) {
      const p = problems.find((x) => x.id === a.problem.id);
      if (!p) throw new Error("no problem");
      const k = monthKey(a.actor.familyId, a.now);
      usage.set(k, (usage.get(k) ?? 0) + a.calls.reduce((s, c) => s + c.costUsd, 0));
      const conflict = p.turnCount !== a.problem.turnCount;
      let t: MsgRow | null = null;
      let reply: StoredReply | null = null;
      if (!conflict) {
        if (p.confirmedStatement === null && a.confirmedStatement) p.confirmedStatement = a.confirmedStatement;
        Object.assign(p, { turnCount: a.turn, status: a.status, statementConfirmed: a.statementConfirmed, hintLevel: a.hintLevel,
          hintLevelMax: a.hintLevelMax, nanJumps: a.nanJumps, wrongCount: a.wrongCount, offtopicCount: a.offtopicCount, uLevel: a.uLevel,
          kuCode: a.kuCode, prereqGaps: [...a.prereqGaps] });
        for (const dg of a.diagnoses) diagnoses.push({ ...dg, problemId: p.id, childId: p.childId });
        reply = { problemId: p.id, message: a.tutorText, buttons: a.buttons, hintLevel: a.replyHintLevel, status: p.status, turnCount: p.turnCount,
          statementConfirmed: p.statementConfirmed };
        t = { id: id("m"), childId: p.childId, problemId: p.id, role: "tutor", text: a.tutorText, buttons: a.buttons, inputKind: "text",
          hintLevel: a.replyHintLevel, clientMsgId: null, at: a.now, reply };
        messages.push(t);
      }
      const first = modelCalls.length;
      for (const c of a.calls)
        modelCalls.push({ ...c, problemId: p.id, childMessageId: a.childMessageId, tutorMessageId: c.shown ? (t?.id ?? null) : null,
          promptVersion: a.promptVersion });
      for (const tr of a.tools)
        toolCalls.push({ problemId: p.id, tool: tr.tool, input: tr.input, output: tr.output, ok: tr.ok, ms: tr.ms, callRow: first + tr.callIndex });
      return reply ?? { conflict: true as const };
    },
    async monthUsage(familyId, now) {
      const k = monthKey(familyId, now);
      return { costUsd: usage.get(k) ?? 0, mode: modes.get(k) ?? "normal", burnAlertSentAt: alerts.get(`${k}|burn`) ?? null,
        economyAlertSentAt: alerts.get(`${k}|economy`) ?? null, consoleAlertSentAt: alerts.get(`${k}|console`) ?? null };
    },
    async pauseStrong(familyId, now) {
      modes.set(monthKey(familyId, now), "economy");
    },
    async resumeStrong(familyId, now) {
      modes.set(monthKey(familyId, now), "normal");
    },
    async markAlert(familyId, kind, now) {
      alerts.set(`${monthKey(familyId, now)}|${kind}`, now);
    },
    async saveForLater(a) {
      const p = problems.find((x) => x.id === a.problemId && x.childId === a.actor.userId);
      if (messages.some((m) => m.childId === a.actor.userId && m.clientMsgId === a.clientMsgId)) return "already";
      if (!p || p.status !== "in_progress") return "not_open";
      messages.push({ id: id("m"), childId: a.actor.userId, problemId: p.id, role: "child", text: BTN_SAVE, buttons: [],
        inputKind: "button", hintLevel: null, clientMsgId: a.clientMsgId, at: a.now });
      p.status = "saved_for_later";
      return "saved";
    },
    async syncAttention(a) {
      if (failAttention.on) throw new Error("attention down");
      attentionSyncs.push({ familyId: a.familyId, childId: a.childId, dateVn: a.dateVn });
    },
    async childRules(childId) {
      return rules.filter((r) => r.childId === childId).map(({ id: rid, status, version, text, sourceKey }) => ({ id: rid, status, version, text, sourceKey }));
    },
    async rulesForSession(sessionId, childId) {
      const sess = sessions.find((x) => x.id === sessionId && x.childId === childId);
      return sess ? activeRules(await repo.childRules(childId), sess.rulesVersion) : [];
    },
    async proposeRule(a) {
      rules.push({ id: id("rule"), childId: a.childId, familyId: a.familyId, status: "proposed", version: 0, text: a.text, sourceKey: a.sourceKey,
        source: a.source, sourceIds: a.sourceIds });
    },
    async endSession(a) {
      const sess = sessions.find((x) => x.id === a.sessionId && x.childId === a.actor.userId);
      if (!sess) return "not_found";
      if (sess.status !== "active") return "already";
      sess.status = "ended";
      for (const p of problems) if (p.sessionId === sess.id && p.status === "in_progress") p.status = "timed_out";
      return "ended";
    },
    async saveRating(a) {
      const sess = sessions.find((x) => x.id === a.sessionId && x.childId === a.actor.userId);
      if (!sess) return "not_found";
      const old = ratings.find((r) => r.sessionId === sess.id);
      if (old) {
        if (a.now.getTime() - old.at.getTime() > RATING_EDIT_MS) return "already";
        Object.assign(old, { face: a.face, reasons: [...a.reasons], comment: a.comment });
        return "updated";
      }
      ratings.push({ id: id("r"), sessionId: sess.id, childId: a.actor.userId, face: a.face, reasons: [...a.reasons], comment: a.comment, at: a.now });
      return "saved";
    },
    async sessionRated(sessionId, childId) {
      return ratings.some((r) => r.sessionId === sessionId && r.childId === childId);
    },
    async latestRatings(childId, n) {
      return ratings.filter((r) => r.childId === childId).sort((x, y) => y.at.getTime() - x.at.getTime()).slice(0, n)
        .map((r) => ({ id: r.id, face: r.face, reasons: [...r.reasons] }));
    },
    async ratingState(problemId, childId) {
      const p = problems.find((x) => x.id === problemId && x.childId === childId);
      const sess = p && sessions.find((x) => x.id === p.sessionId);
      if (!p || !sess) return null;
      const mine = problems.filter((x) => x.sessionId === sess.id);
      const earlierEnded = mine.slice(0, mine.indexOf(p)).some((x) => RATING_OUTCOMES.includes(x.status));
      return { sessionId: sess.id, sessionStatus: sess.status, rated: ratings.some((r) => r.sessionId === sess.id), earlierEnded };
    },
  };
  return Object.assign(repo, { sessions, problems, messages, modelCalls, usage, modes, images, toolCalls, diagnoses, attentionSyncs, failAttention, rules, ratings, alerts });
}

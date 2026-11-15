// In-memory TutorRepo for the handler tests. Same contract as lib/db/supabaseRepo.ts.
import { BTN_SAVE } from "@/lib/copy";
import type { HintLevel } from "@/lib/rules/hints";
import type { InputKind } from "@/lib/rules/events";
import type { Msg } from "@/lib/tutor/assemble";
import {
  flagsOf, type FoundMessage, type ModelCallRecord, type ProblemRow, type ProblemStatus, type SaveReplyInput, type StoredReply,
  type StuckKind, type TutorRepo,
} from "@/lib/tutor/repo";

interface Sess { id: string; childId: string; dateVn: string; status: "active" | "ended" | "abandoned"; device: string }
interface Prob { id: string; childId: string; familyId: string; sessionId: string; status: ProblemStatus; turnCount: number;
  hintLevel: HintLevel; hintLevelMax: HintLevel; nanJumps: number; wrongCount: number; offtopicCount: number; uLevel: 0 | 1 | 2 | 3;
  stuckKind: StuckKind | null; statementConfirmed: boolean }
interface MsgRow { id: string; childId: string; problemId: string; role: "child" | "tutor"; text: string; buttons: string[];
  inputKind: InputKind; hintLevel: number | null; clientMsgId: string | null; at: Date; reply?: StoredReply }
type CallRow = ModelCallRecord & { problemId: string; childMessageId: string; tutorMessageId: string | null; promptVersion: string };

export interface Seed {
  sessions?: Partial<Sess>[];
  problems?: (Partial<Prob> & { id: string; childId: string })[];
  messages?: (Partial<MsgRow> & { problemId: string; role: "child" | "tutor"; text: string })[];
  /** earlier model calls (e.g. a strong-model call, or the flags of the last answer) */
  calls?: (Partial<CallRow> & { problemId: string })[];
  usage?: { familyId?: string; month: string; costUsd: number; mode?: "normal" | "economy" }[];
}

export function memoryRepo(seed: Seed = {}, strongModel = "claude-opus-5-5") {
  let n = 0;
  const id = (p: string) => `${p}${++n}`;
  const sessions: Sess[] = (seed.sessions ?? []).map((s) => ({ id: id("s"), childId: "c1", dateVn: "2026-11-14", status: "active", device: "laptop", ...s }));
  const problems: Prob[] = (seed.problems ?? []).map((p) => ({ familyId: "f1", sessionId: "s0", status: "in_progress", turnCount: 0,
    hintLevel: 0, hintLevelMax: 0, nanJumps: 0, wrongCount: 0, offtopicCount: 0, uLevel: 0, stuckKind: null, statementConfirmed: false, ...p }));
  const messages: MsgRow[] = (seed.messages ?? []).map((m) => ({ id: id("m"), childId: "c1", buttons: [], clientMsgId: null,
    inputKind: "text", hintLevel: null, at: new Date("2026-11-14T10:00:00Z"), ...m }));
  const modelCalls: CallRow[] = (seed.calls ?? []).map((c) => ({ purpose: "tutor", model: "claude-sonnet-5-5", raw: "{}", costUsd: 0,
    tokens: { in: 0, cached: 0, out: 0 }, routeReason: null, guardResult: null, guardReasons: [], shown: true, childMessageId: "",
    tutorMessageId: "", promptVersion: "test", ...c }));
  const usage = new Map<string, number>();
  const modes = new Map<string, "normal" | "economy">();
  for (const u of seed.usage ?? []) {
    usage.set(`${u.familyId ?? "f1"}|${u.month}`, u.costUsd);
    if (u.mode) modes.set(`${u.familyId ?? "f1"}|${u.month}`, u.mode);
  }
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
      const s: Sess = { id: id("s"), childId: a.actor.userId, dateVn: a.dateVn, status: "active", device: a.device };
      sessions.push(s);
      return { id: s.id, reused: false };
    },
    async createProblem(a) {
      const p: Prob = { id: id("p"), childId: a.actor.userId, familyId: a.actor.familyId, sessionId: a.sessionId, status: "in_progress",
        turnCount: 0, hintLevel: 0, hintLevelMax: 0, nanJumps: 0, wrongCount: 0, offtopicCount: 0, uLevel: 0, stuckKind: a.stuckKind,
        statementConfirmed: false };
      problems.push(p);
      return { id: p.id };
    },
    async setProblemStatus(problemId, status) {
      const p = problems.find((x) => x.id === problemId);
      if (p) p.status = status;
    },
    async getProblemForChild(problemId, childId) {
      const p = problems.find((x) => x.id === problemId && x.childId === childId);
      if (!p) return null;
      const list = messages.filter((m) => m.problemId === p.id);
      const last = list[list.length - 1];
      const answered = last?.role === "child" ? list.slice(0, -1) : list;
      const history: Msg[] = answered.map((m) => ({ role: m.role === "child" ? "user" : "assistant", content: m.text }));
      const pending = last?.role === "child" ? { messageId: last.id, clientMsgId: last.clientMsgId, text: last.text, at: last.at } : null;
      const calls = modelCalls.filter((c) => c.problemId === p.id);
      const lastShown = calls.filter((c) => c.purpose === "tutor" && c.shown).at(-1);
      const row: ProblemRow = {
        id: p.id, childId: p.childId, familyId: p.familyId, sessionId: p.sessionId, status: p.status, turnCount: p.turnCount,
        hintLevel: p.hintLevel, hintLevelMax: p.hintLevelMax, nanJumps: p.nanJumps, wrongCount: p.wrongCount,
        offtopicCount: p.offtopicCount, uLevel: p.uLevel, stuckKind: p.stuckKind, statementConfirmed: p.statementConfirmed, history,
        thread: list.map((m) => ({ id: m.id, role: m.role, content: m.text, inputKind: m.inputKind })),
        statement: list.find((m) => m.role === "child")?.text ?? null,
        usedStrong: calls.some((c) => c.purpose === "tutor" && c.model === strongModel),
        lastTutorFlags: lastShown ? flagsOf(lastShown.raw) : [],
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
        Object.assign(p, { turnCount: a.turn, status: a.status, statementConfirmed: a.statementConfirmed, hintLevel: a.hintLevel,
          hintLevelMax: a.hintLevelMax, nanJumps: a.nanJumps, wrongCount: a.wrongCount, offtopicCount: a.offtopicCount, uLevel: a.uLevel });
        reply = { problemId: p.id, message: a.tutorText, buttons: a.buttons, hintLevel: a.replyHintLevel, status: p.status, turnCount: p.turnCount };
        t = { id: id("m"), childId: p.childId, problemId: p.id, role: "tutor", text: a.tutorText, buttons: a.buttons, inputKind: "text",
          hintLevel: a.replyHintLevel, clientMsgId: null, at: a.now, reply };
        messages.push(t);
      }
      for (const c of a.calls)
        modelCalls.push({ ...c, problemId: p.id, childMessageId: a.childMessageId, tutorMessageId: c.shown ? (t?.id ?? null) : null,
          promptVersion: a.promptVersion });
      return reply ?? { conflict: true as const };
    },
    async monthUsage(familyId, now) {
      const k = monthKey(familyId, now);
      return { costUsd: usage.get(k) ?? 0, mode: modes.get(k) ?? "normal" };
    },
    async pauseStrong(familyId, now) {
      modes.set(monthKey(familyId, now), "economy");
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
  };
  return Object.assign(repo, { sessions, problems, messages, modelCalls, usage, modes });
}

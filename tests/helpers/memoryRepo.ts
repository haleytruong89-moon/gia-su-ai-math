// In-memory TutorRepo for the handler tests. Same contract as lib/db/supabaseRepo.ts.
import type { Msg } from "@/lib/tutor/assemble";
import type { FoundMessage, ProblemRow, ProblemStatus, SaveReplyInput, StoredReply, StuckKind, TutorRepo } from "@/lib/tutor/repo";

interface Sess { id: string; childId: string; dateVn: string; status: "active" | "ended" | "abandoned"; device: string }
interface Prob { id: string; childId: string; familyId: string; sessionId: string; status: ProblemStatus; turnCount: number;
  hintLevel: number; wrongCount: number; stuckKind: StuckKind | null; statementConfirmed: boolean }
interface MsgRow { id: string; childId: string; problemId: string; role: "child" | "tutor"; text: string; buttons: string[];
  clientMsgId: string | null; at: Date; reply?: StoredReply }

export interface Seed {
  sessions?: Partial<Sess>[];
  problems?: (Partial<Prob> & { id: string; childId: string })[];
  messages?: (Partial<MsgRow> & { problemId: string; role: "child" | "tutor"; text: string })[];
}

export function memoryRepo(seed: Seed = {}) {
  let n = 0;
  const id = (p: string) => `${p}${++n}`;
  const sessions: Sess[] = (seed.sessions ?? []).map((s) => ({ id: id("s"), childId: "c1", dateVn: "2026-11-14", status: "active", device: "laptop", ...s }));
  const problems: Prob[] = (seed.problems ?? []).map((p) => ({ familyId: "f1", sessionId: "s0", status: "in_progress", turnCount: 0,
    hintLevel: 0, wrongCount: 0, stuckKind: null, statementConfirmed: false, ...p }));
  const messages: MsgRow[] = (seed.messages ?? []).map((m) => ({ id: id("m"), childId: "c1", buttons: [], clientMsgId: null,
    at: new Date("2026-11-14T10:00:00Z"), ...m }));
  const modelCalls: { childMessageId: string; tutorMessageId: string; costUsd: number; raw: string; promptVersion: string }[] = [];
  const usage = new Map<string, number>();

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
        turnCount: 0, hintLevel: 0, wrongCount: 0, stuckKind: a.stuckKind, statementConfirmed: false };
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
      return { ...p, history, pending } satisfies ProblemRow;
    },
    async findByClientMsg(childId, clientMsgId): Promise<FoundMessage | null> {
      const m = messages.find((x) => x.childId === childId && x.clientMsgId === clientMsgId);
      return m ? { problemId: m.problemId, messageId: m.id, text: m.text, at: m.at, reply: replyAfter(m) } : null;
    },
    async insertChildMessage(a) {
      if (messages.some((m) => m.childId === a.actor.userId && m.clientMsgId === a.clientMsgId)) return { conflict: true };
      const m: MsgRow = { id: id("m"), childId: a.actor.userId, problemId: a.problemId, role: "child", text: a.text, buttons: [],
        clientMsgId: a.clientMsgId, at: a.now };
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
      const month = `${a.now.toISOString().slice(0, 7)}-01`;
      usage.set(`${a.actor.familyId}|${month}`, (usage.get(`${a.actor.familyId}|${month}`) ?? 0) + a.costUsd);
      if (p.turnCount !== a.problem.turnCount) return { conflict: true as const };
      p.turnCount = a.turn;
      p.status = a.status;
      p.statementConfirmed = a.statementConfirmed;
      const reply: StoredReply = { problemId: p.id, message: a.tutorText, buttons: a.buttons, hintLevel: p.hintLevel, status: p.status, turnCount: p.turnCount };
      const t: MsgRow = { id: id("m"), childId: p.childId, problemId: p.id, role: "tutor", text: a.tutorText, buttons: a.buttons,
        clientMsgId: null, at: a.now, reply };
      messages.push(t);
      modelCalls.push({ childMessageId: a.childMessageId, tutorMessageId: t.id, costUsd: a.costUsd, raw: a.rawOutput, promptVersion: a.promptVersion });
      return reply;
    },
  };
  return Object.assign(repo, { sessions, problems, messages, modelCalls, usage });
}

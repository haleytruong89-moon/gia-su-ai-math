// lib/tutor/handlers.ts — the server side of a tutor turn, pure apart from the injected repo and
// model client (tested in tests/handlers.test.ts). The route files only wire real dependencies.
//
// G1 (walking skeleton): one model call per turn, no guard, no tools, hint level stays H0.
// G2 adds the hint ladder + nản + guard, G4 the tools and the solve gate (docs/DESIGN.md §9).
import { z } from "zod";
import type { Actor } from "@/lib/actor";
import { SAFE_BUSY, SAFE_REPLY } from "@/lib/copy";
import { dateVn } from "@/lib/time";
import { assemble } from "@/lib/tutor/assemble";
import type { Layers } from "@/lib/tutor/layers";
import { STUCK_KINDS, type ChildActor, type PendingMessage, type ProblemRow, type ProblemStatus, type TutorRepo } from "@/lib/tutor/repo";
import { runTutorTurn, type ModelClient } from "@/lib/tutor/turn";

/** D15: at most 20 turns per problem; turn 20 closes it. */
export const MAX_TURNS = 20;
/** A child message without a reply after this long is treated as lost (the server call died). */
export const STALE_PENDING_MS = 150_000;

export interface Deps {
  repo: TutorRepo;
  client: ModelClient;
  actor: Actor | null;
  now: Date;
  layers: Layers;
  promptVersion: string;
  modelMain: string;
}
type Result = { status: number; json: unknown };

const device = z.enum(["ipad", "boox", "laptop"]).catch("laptop");
const sessionBody = z.object({ device: device.optional() }).catch({});
const problemBody = z.object({
  clientMsgId: z.string().uuid(),
  stuckKind: z.enum(STUCK_KINDS).nullable(),
  statement: z.string().trim().min(1).max(2000),
  device: device.optional(),
});
const turnBody = z.object({
  problemId: z.string().min(1).max(64),
  clientMsgId: z.string().uuid(),
  text: z.string().trim().min(1).max(2000),
});

const unauthorized: Result = { status: 401, json: { error: "unauthorized" } };
const badRequest: Result = { status: 400, json: { error: "bad_request" } };
const pending: Result = { status: 409, json: { error: "pending" } };
const busy: Result = { status: 503, json: { error: "model_unavailable", message: SAFE_BUSY } };

const asChild = (a: Actor | null): ChildActor | null => (a?.role === "child" ? a : null);
const isStale = (p: PendingMessage, now: Date) => now.getTime() - p.at.getTime() > STALE_PENDING_MS;

export async function startSession(d: Deps, raw: unknown): Promise<Result> {
  const actor = asChild(d.actor);
  if (!actor) return unauthorized;
  const { device: dev } = sessionBody.parse(raw ?? {});
  const s = await d.repo.openSession({ actor, device: dev ?? "laptop", dateVn: dateVn(d.now), promptVersion: d.promptVersion, modelMain: d.modelMain });
  return { status: 200, json: { sessionId: s.id, reused: s.reused } };
}

/** Opens a problem from the typed statement and runs its first turn (the tutor restates it). */
export async function newProblem(d: Deps, raw: unknown): Promise<Result> {
  const actor = asChild(d.actor);
  if (!actor) return unauthorized;
  const parsed = problemBody.safeParse(raw);
  if (!parsed.success) return badRequest;
  const { clientMsgId, stuckKind, statement } = parsed.data;

  // A double tap or a resend: answer with the problem the first tap opened.
  const seen = await d.repo.findByClientMsg(actor.userId, clientMsgId);
  if (seen) {
    if (seen.reply) return { status: 200, json: { problemId: seen.problemId, reply: seen.reply } };
    if (!isStale({ messageId: seen.messageId, clientMsgId, text: seen.text, at: seen.at }, d.now)) return pending;
    // The first call died before replying: run the first turn again on that problem.
    const stuck = await d.repo.getProblemForChild(seen.problemId, actor.userId);
    if (!stuck || stuck.status !== "in_progress") return closed(stuck?.status ?? "abandoned");
    const again = await runClaimed(d, actor, stuck, seen.messageId, seen.text);
    return again.status === 200 ? { status: 200, json: { problemId: stuck.id, reply: again.json } } : again;
  }

  const session = await d.repo.openSession({ actor, device: parsed.data.device ?? "laptop", dateVn: dateVn(d.now),
    promptVersion: d.promptVersion, modelMain: d.modelMain });
  const { id } = await d.repo.createProblem({ actor, sessionId: session.id, stuckKind });
  const problem = await d.repo.getProblemForChild(id, actor.userId);
  if (!problem) throw new Error("problem vanished after insert");
  const r = await runTurn(d, actor, problem, clientMsgId, statement);
  // Model down, or a parallel double tap won the clientMsgId: this problem stays empty.
  if (r.status !== 200) await d.repo.setProblemStatus(id, "abandoned", d.now);
  return r.status === 200 ? { status: 200, json: { problemId: id, reply: r.json } } : r;
}

export async function handleTurn(d: Deps, raw: unknown): Promise<Result> {
  const actor = asChild(d.actor);
  if (!actor) return unauthorized;
  const parsed = turnBody.safeParse(raw);
  if (!parsed.success) return badRequest;
  const { problemId, clientMsgId, text } = parsed.data;

  // The child id comes from the session only; a problem of another child looks like no problem.
  const problem = await d.repo.getProblemForChild(problemId, actor.userId);
  if (!problem) return { status: 404, json: { error: "not_found" } };

  const seen = await d.repo.findByClientMsg(actor.userId, clientMsgId);
  if (seen) {
    if (seen.problemId !== problemId) return { status: 409, json: { error: "client_msg_reused" } };
    if (seen.reply) return { status: 200, json: seen.reply };
    if (!isStale({ messageId: seen.messageId, clientMsgId, text: seen.text, at: seen.at }, d.now)) return pending;
    // The first call died before replying: run the turn again with what the child sent then.
    if (problem.status !== "in_progress") return closed(problem.status);
    return runClaimed(d, actor, problem, seen.messageId, seen.text);
  }
  if (problem.status !== "in_progress") return closed(problem.status);
  return runTurn(d, actor, problem, clientMsgId, text);
}

const closed = (status: ProblemStatus): Result => ({ status: 409, json: { error: "problem_closed", status } });

async function runTurn(d: Deps, actor: ChildActor, problem: ProblemRow, clientMsgId: string, text: string): Promise<Result> {
  if (problem.pending) {
    if (!isStale(problem.pending, d.now)) return pending; // one turn at a time per problem
    await d.repo.deleteMessage(problem.pending.messageId);
  }
  const claim = await d.repo.insertChildMessage({ actor, problemId: problem.id, clientMsgId, text, now: d.now });
  if ("conflict" in claim) return pending;
  return runClaimed(d, actor, problem, claim.messageId, text);
}

async function runClaimed(d: Deps, actor: ChildActor, problem: ProblemRow, messageId: string, text: string): Promise<Result> {
  const turn = problem.turnCount + 1;
  const { system, messages } = assemble({
    layers: d.layers,
    profileText: actor.profileText,
    knowledgeCard: null,
    history: problem.history,
    childText: text,
    state: {
      grade: actor.grade, hintLevel: problem.hintLevel, wrongCount: problem.wrongCount, nan: false, idle: false,
      submitted: false, mode: "thuong", minutesLeft: 45, turn, stuckKind: problem.stuckKind, kuCode: null, examSlot: null,
    },
  });

  let result: Awaited<ReturnType<typeof runTutorTurn>>;
  try {
    result = await runTutorTurn(d.client, { model: d.modelMain, system, messages });
  } catch (e) {
    console.error("tutor model call failed", e instanceof Error ? e.message : "unknown"); // never the child's text
    await d.repo.deleteMessage(messageId);
    return busy;
  }

  const out = result.output;
  const saved = await d.repo.saveReply({
    actor, problem, childMessageId: messageId, turn,
    status: turn >= MAX_TURNS ? "timed_out" : "in_progress",
    statementConfirmed: problem.statementConfirmed || out?.de_da_xac_nhan === true,
    tutorText: out?.message ?? SAFE_REPLY,
    buttons: out?.buttons ?? [],
    rawOutput: result.raw,
    model: d.modelMain,
    promptVersion: d.promptVersion,
    costUsd: result.costUsd,
    tokens: result.tokens,
    now: d.now,
  });
  if ("conflict" in saved) {
    // Another device saved a turn of this problem meanwhile: drop this message; the client's
    // retry of the same clientMsgId runs it again on top of the newer turn.
    await d.repo.deleteMessage(messageId);
    return pending;
  }
  return { status: 200, json: saved };
}

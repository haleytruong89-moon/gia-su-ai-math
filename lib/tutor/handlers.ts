// lib/tutor/handlers.ts — the server side of a tutor turn, pure apart from the injected repo and
// model client (tested in tests/handlers.test.ts). The route files only wire real dependencies.
//
// G2: one turn = nản check → hint level → model choice (Sonnet / Opus) → answer → Haiku checker →
// one rewrite → safe line → next hint level → problem outcome (docs/DESIGN.md §4, DOMAIN §4.1, §4.2,
// §4.14, §5). G4 adds the tools and math_check (until then self_solved is never allowed).
import { applyTicks, currentPlan, formatPlan, planEventText } from "@/lib/rules/plan";
import { validPlan } from "@/lib/tutor/planCheck";
import { linesAllowed, sampleChecked } from "@/lib/tutor/lines";
import { z } from "zod";
import type { Actor } from "@/lib/actor";
import { BTN_CARD_AGAIN, BTN_CARD_OK, CARD_BUTTONS, CARD_FALLBACK_INTRO, PHOTO_COPY, PHOTO_ONLY_TEXT, SAFE_BUSY, SPEND_PAUSED, safeLine, safeLinesInARow } from "@/lib/copy";
import { burnAlertDue, consoleAlertDue, economyAlertDue, isSpendLimitError } from "@/lib/rules/cost";
import { processImage } from "@/lib/images";
import { maxImagesFor } from "@/lib/rules/photoLimit";
import { isTooBig } from "@/lib/tutor/form";
import { childEvents, type InputKind } from "@/lib/rules/events";
import { applyPreTurn, nextHintLevel, type HintLevel } from "@/lib/rules/hints";
import { pickModel, rewriteRoute, strongPaused, type ModelTier, type RouteReason } from "@/lib/rules/model";
import { isNanSignal, saysNoIdea } from "@/lib/rules/nan";
import { checksFrom, decideOutcome } from "@/lib/rules/outcome";
import type { CasClient } from "@/lib/tools/casClient";
import type { ToolRecord } from "@/lib/tools/defs";
import { runMathCheck } from "@/lib/tools/mathCheck";
import { runLookup } from "@/lib/tools/lookup";
import { knowledgeCard } from "@/lib/knowledge/card";
import { codeFitsGrade, knowledgeVersion } from "@/lib/knowledge/load";
import { classifyProblem, EMPTY, type Classification } from "@/lib/tutor/classify";
import { makeSibling, type SiblingCall, type SiblingInput } from "@/lib/tools/makeSibling";
import { runToolLoop, type LoopResult } from "@/lib/tutor/toolLoop";
import { dateVn } from "@/lib/time";
import { RATING_REASONS, ratingProposal, rulesBlock, rulesVersionNow, type RatingReason } from "@/lib/rules/teachingRules";
import { assemble, type ImageData, type Msg, type Turn } from "@/lib/tutor/assemble";
import { writeReference, type ChildCheck } from "@/lib/tutor/reference";
import { card as cardOf, cardFitsGrade, cardForModel, cardIndexText, lessonCard, pickVariant } from "@/lib/knowledge/cards";
import { lastCardOf, scriptedTurn, type Scripted } from "@/lib/tutor/scripted";
import { reviewItemsFromCard } from "@/lib/rules/review";
import { runGuard, type GuardResult } from "@/lib/tutor/guard";
import type { Layers } from "@/lib/tutor/layers";
import {
  STUCK_KINDS, type ChildActor, type Device, type Diagnosis, type ModelCallRecord, type PendingMessage, type ProblemRow, type ProblemStatus, type TutorRepo,
} from "@/lib/tutor/repo";
import type { TutorOutput } from "@/lib/tutor/schema";
import { runTutorTurn, type ModelClient } from "@/lib/tutor/turn";

export { MAX_TURNS } from "@/lib/rules/outcome";
/**
 * A turn may make 4 model calls (answer, check, rewrite, check), each up to 2 × 50 s (lib/anthropic.ts).
 * TURN_BUDGET_MS caps the turn well inside the route's maxDuration (300 s); a child message without a
 * reply after STALE_PENDING_MS is treated as lost (the server call died).
 */
export const TURN_BUDGET_MS = 240_000;
export const STALE_PENDING_MS = 330_000;
/** Time a checker call / a rewrite + its check needs to be worth starting. */
const GUARD_NEEDS_MS = 60_000;
const REWRITE_NEEDS_MS = 110_000;
/** make_sibling = 1–2 model calls + cas: only started with this much time left. */
const SIBLING_NEEDS_MS = 90_000;
/** G5: the classifier (Haiku, first turn of a problem) only runs with plenty of turn left. */
const CLASSIFY_NEEDS_MS = 200_000;

export interface Deps {
  repo: TutorRepo;
  client: ModelClient;
  actor: Actor | null;
  now: Date;
  layers: Layers;
  promptVersion: string;
  /** main = Sonnet, strong = Opus (D28), light = Haiku (checker) */
  models: { main: string; strong: string; light: string };
  /** wall clock in ms, for the turn budget (tests move it) */
  clock?: () => number;
  /** the private math checker (G4); null when not configured → math_check answers an error */
  cas: CasClient | null;
  /** G5: classify the first turn of each problem (knowledge card, Opus signals). Off in tests that do not test it. */
  classify?: boolean;
  /** G7c (D23): asks the Launcher to push a money message to the parents; true when it was sent. Absent → no pushes. */
  notify?: (kind: "economy" | "console_blocked" | "burn", familyId: string, forecastUsd?: number) => Promise<boolean>;
  /** Runs work after the answer is sent (Next `after` in routes). Absent (tests) → awaited before returning. */
  later?: (work: () => Promise<void>) => void;
}
type Result = { status: number; json: unknown };

const device = z.enum(["ipad", "boox", "laptop"]).catch("laptop");
const sessionBody = z.object({ device: device.optional() }).catch({});
// Multipart sends every field as a string: "" means "not given".
const blankToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const photo = z.instanceof(Uint8Array).optional();
const problemBody = z.object({
  clientMsgId: z.string().uuid(),
  stuckKind: z.preprocess(blankToNull, z.enum(STUCK_KINDS).nullable()),
  statement: z.string().trim().max(2000).default(""),
  device: device.optional(),
  image: photo,
  /** retake (G3 Q3): the unconfirmed problem this one replaces */
  replacesProblemId: z.preprocess(blankToNull, z.string().uuid().nullable()).optional(),
}).refine((b) => b.statement.length > 0 || b.image !== undefined);
const turnBody = z.object({
  problemId: z.string().min(1).max(64),
  clientMsgId: z.string().uuid(),
  text: z.string().trim().max(2000).default(""),
  /** how the child sent it: typed, a button (incl. "Chưa hiểu"), or marked as the final answer */
  kind: z.enum(["text", "button", "submit"]).default("text"),
  device: device.optional(),
  /** a photo of the child's work (G3 Q2) */
  image: photo,
}).refine((b) => b.text.length > 0 || b.image !== undefined);
const saveBody = z.object({ problemId: z.string().min(1).max(64), clientMsgId: z.string().uuid() });
const tickBody = z.object({ problemId: z.string().min(1).max(64), clientMsgId: z.string().uuid(), step: z.number().int().min(1).max(7),
  done: z.boolean() });
const endBody = z.object({ sessionId: z.string().min(1).max(64) });
const rateBody = z.object({
  sessionId: z.string().min(1).max(64),
  face: z.enum(["easy", "ok", "hard"]),
  reasons: z.array(z.enum(RATING_REASONS as [string, ...string[]])).max(6).default([]),
  comment: z.string().max(500).nullish(),
});

const unauthorized: Result = { status: 401, json: { error: "unauthorized" } };
const badRequest: Result = { status: 400, json: { error: "bad_request" } };
const pending: Result = { status: 409, json: { error: "pending" } };
const busy: Result = { status: 503, json: { error: "model_unavailable", message: SAFE_BUSY } };
const spendPaused: Result = { status: 503, json: { error: "spend_limit", message: SPEND_PAUSED } };
const tooBig: Result = { status: 413, json: { error: "image_too_big", message: PHOTO_COPY.tooBig } };
const notImage: Result = { status: 415, json: { error: "not_an_image", message: PHOTO_COPY.unreadable } };
const tooMany: Result = { status: 409, json: { error: "too_many_images", message: PHOTO_COPY.tooMany } };

type Photo = { jpeg: Buffer; width: number; height: number; device: Device };
/** Cleans the photo before anything is stored; null when none was sent. */
async function cleanPhoto(image: Uint8Array | undefined, dev: Device): Promise<{ photo: Photo | null } | { error: Result }> {
  if (!image) return { photo: null };
  const r = await processImage(image);
  if (!r.ok) return { error: r.error === "too_big" ? tooBig : notImage };
  return { photo: { jpeg: r.jpeg, width: r.width, height: r.height, device: dev } };
}

const asChild = (a: Actor | null): ChildActor | null => (a?.role === "child" ? a : null);
const isStale = (p: PendingMessage, now: Date) => now.getTime() - p.at.getTime() > STALE_PENDING_MS;

export async function startSession(d: Deps, raw: unknown): Promise<Result> {
  const actor = asChild(d.actor);
  if (!actor) return unauthorized;
  const { device: dev } = sessionBody.parse(raw ?? {});
  const s = await d.repo.openSession({ actor, device: dev ?? "laptop", dateVn: dateVn(d.now), promptVersion: d.promptVersion, modelMain: d.models.main,
    rulesVersion: rulesVersionNow(await d.repo.childRules(actor.userId)) });
  return { status: 200, json: { sessionId: s.id, reused: s.reused } };
}

/** Opens a problem from the typed statement and runs its first turn (the tutor restates it). */
export async function newProblem(d: Deps, raw: unknown): Promise<Result> {
  const actor = asChild(d.actor);
  if (!actor) return unauthorized;
  if (isTooBig(raw)) return tooBig;
  const parsed = problemBody.safeParse(raw);
  if (!parsed.success) return badRequest;
  const { clientMsgId, stuckKind, statement, image, replacesProblemId } = parsed.data;
  const text = statement || PHOTO_ONLY_TEXT;

  // A double tap or a resend: answer with the problem the first tap opened.
  const seen = await d.repo.findByClientMsg(actor.userId, clientMsgId);
  if (seen) {
    if (seen.reply) return { status: 200, json: { problemId: seen.problemId, reply: { ...seen.reply, planTicks: [] } } };
    if (!isStale({ messageId: seen.messageId, clientMsgId, text: seen.text, at: seen.at }, d.now)) return pending;
    // The first call died before replying: run the first turn again on that problem.
    const stuck = await d.repo.getProblemForChild(seen.problemId, actor.userId);
    if (!stuck || stuck.status !== "in_progress") return closed(stuck?.status ?? "abandoned");
    const again = await runClaimed(d, actor, stuck, seen.messageId, seen.text, "text");
    return again.status === 200 ? { status: 200, json: { problemId: stuck.id, reply: again.json } } : again;
  }

  const dev = parsed.data.device ?? "laptop";
  const cleaned = await cleanPhoto(image, dev);
  if ("error" in cleaned) return cleaned.error;
  // Retake: the problem read from the old photo is dropped if its statement was never confirmed.
  if (replacesProblemId) await d.repo.abandonUnconfirmed(replacesProblemId, actor.userId, d.now);

  const session = await d.repo.openSession({ actor, device: dev, dateVn: dateVn(d.now),
    promptVersion: d.promptVersion, modelMain: d.models.main, rulesVersion: rulesVersionNow(await d.repo.childRules(actor.userId)) });
  const { id } = await d.repo.createProblem({ actor, sessionId: session.id, stuckKind });
  const problem = await d.repo.getProblemForChild(id, actor.userId);
  if (!problem) throw new Error("problem vanished after insert");
  const r = await runTurn(d, actor, problem, clientMsgId, text, "text", cleaned.photo);
  // Model down, or a parallel double tap won the clientMsgId: this problem stays empty.
  if (r.status !== 200) await d.repo.setProblemStatus(id, "abandoned", d.now);
  return r.status === 200 ? { status: 200, json: { problemId: id, reply: r.json } } : r;
}

export async function handleTurn(d: Deps, raw: unknown): Promise<Result> {
  const actor = asChild(d.actor);
  if (!actor) return unauthorized;
  if (isTooBig(raw)) return tooBig;
  const parsed = turnBody.safeParse(raw);
  if (!parsed.success) return badRequest;
  const { problemId, clientMsgId, kind, image } = parsed.data;
  const text = parsed.data.text || PHOTO_ONLY_TEXT;

  // The child id comes from the session only; a problem of another child looks like no problem.
  const problem = await d.repo.getProblemForChild(problemId, actor.userId);
  if (!problem) return { status: 404, json: { error: "not_found" } };

  const seen = await d.repo.findByClientMsg(actor.userId, clientMsgId);
  if (seen) {
    if (seen.problemId !== problemId) return { status: 409, json: { error: "client_msg_reused" } };
    if (seen.reply) return { status: 200, json: { ...seen.reply, planTicks: problem.planTicks } };
    if (!isStale({ messageId: seen.messageId, clientMsgId, text: seen.text, at: seen.at }, d.now)) return pending;
    // The first call died before replying: run the turn again with what the child sent then.
    if (problem.status !== "in_progress") return closed(problem.status);
    const stored = problem.thread.find((m) => m.id === seen.messageId)?.inputKind ?? kind;
    const again = scriptedFor(actor, problem, seen.text, stored);
    if (again) return saveScripted(d, actor, problem, again);
    return runClaimed(d, actor, problem, seen.messageId, seen.text, stored);
  }
  if (problem.status !== "in_progress") return closed(problem.status);
  // G6 (Y3): card way 2 and "Em không hiểu đề" are answered by the server, without the model and without a turn.
  const s = image ? null : scriptedFor(actor, problem, text, kind);
  if (s) return runScripted(d, actor, problem, clientMsgId, text, kind, s);
  if (image && problem.imageCount >= maxImagesFor(problem.kuCode)) return tooMany; // G8-fix: 6 for geometry
  const cleaned = await cleanPhoto(image, parsed.data.device ?? "laptop");
  if ("error" in cleaned) return cleaned.error;
  return runTurn(d, actor, problem, clientMsgId, text, kind, cleaned.photo);
}

/** "Để dành hỏi thầy" (DOMAIN §3.2): allowed at any time while the problem is open. */
export async function saveForLater(d: Deps, raw: unknown): Promise<Result> {
  const actor = asChild(d.actor);
  if (!actor) return unauthorized;
  const parsed = saveBody.safeParse(raw);
  if (!parsed.success) return badRequest;
  const problem = await d.repo.getProblemForChild(parsed.data.problemId, actor.userId);
  if (!problem) return { status: 404, json: { error: "not_found" } };
  const r = await d.repo.saveForLater({ actor, problemId: problem.id, clientMsgId: parsed.data.clientMsgId, now: d.now });
  if (r === "not_open") return closed(problem.status);
  if (r === "saved") await syncAttention(d, actor);
  return { status: 200, json: { status: "saved_for_later" } };
}

/**
 * D38: the child ticks (or unticks) a job of "Bài của em". No model call, no turn counted. When the last job of a
 * list that came with an approved card is ticked, the card's review questions join the queue (as "Em hiểu rồi" did).
 */
export async function tickPlan(d: Deps, raw: unknown): Promise<Result> {
  const actor = asChild(d.actor);
  if (!actor) return unauthorized;
  const parsed = tickBody.safeParse(raw);
  if (!parsed.success) return badRequest;
  const { problemId, clientMsgId, step, done } = parsed.data;
  const problem = await d.repo.getProblemForChild(problemId, actor.userId);
  if (!problem) return { status: 404, json: { error: "not_found" } };
  if (problem.status !== "in_progress") return closed(problem.status);
  const plan = currentPlan(problem.thread);
  if (!plan || step > plan.steps.length) return { status: 409, json: { error: "no_such_job" } };
  const r = await d.repo.savePlanEvent({ actor, problemId, clientMsgId, content: planEventText({ step, done }), now: d.now });
  const ticks = r === "already" ? problem.planTicks : applyTicks(problem.planTicks, [{ step, done }]);
  const allDone = ticks.length === plan.steps.length;
  if (r === "saved" && allDone && problem.planTicks.length < plan.steps.length && plan.cardRef) {
    try {
      const c = cardOf(plan.cardRef.split("#")[0]!);
      if (c && cardFitsGrade(c, actor.grade)) await d.repo.addReviewItems({ actor, items: reviewItemsFromCard(c, dateVn(d.now)), now: d.now });
    } catch (err) {
      console.error("review queue failed", err instanceof Error ? err.message : "unknown");
    }
  }
  return { status: 200, json: { planTicks: ticks, allDone } };
}

/** Layer ④: the teaching profile, then the parents' approved rules of the session (G7b, §3.4). */
const withRules = (profile: string, rules: string) => (rules ? `${profile}\n\n${rules}` : profile);

/** "Kết thúc buổi" (DOMAIN §3.1): the child ends the session; the rating card follows if not rated (P2). */
export async function endSession(d: Deps, raw: unknown): Promise<Result> {
  const actor = asChild(d.actor);
  if (!actor) return unauthorized;
  const parsed = endBody.safeParse(raw);
  if (!parsed.success) return badRequest;
  const r = await d.repo.endSession({ actor, sessionId: parsed.data.sessionId, now: d.now });
  if (r === "not_found") return { status: 404, json: { error: "not_found" } };
  if (r === "ended") await syncAttention(d, actor);
  const rated = await d.repo.sessionRated(parsed.data.sessionId, actor.userId);
  return { status: 200, json: { status: r, rated } };
}

/**
 * Con chấm cô (US6, P2): one tap saves; reasons may follow for a short while. Then the day's
 * attention lines are rewritten (😕 is a flag) and a rule may be proposed (P3: 😕 twice, same reason).
 */
export async function rateSession(d: Deps, raw: unknown): Promise<Result> {
  const actor = asChild(d.actor);
  if (!actor) return unauthorized;
  const parsed = rateBody.safeParse(raw);
  if (!parsed.success) return badRequest;
  const { sessionId, face, reasons, comment } = parsed.data;
  const r = await d.repo.saveRating({ actor, sessionId, face, reasons: reasons as RatingReason[], comment: comment?.trim() || null, now: d.now });
  if (r === "not_found") return { status: 404, json: { error: "not_found" } };
  if (r !== "already") {
    await syncAttention(d, actor);
    try {
      const two = await d.repo.latestRatings(actor.userId, 2);
      const proposal = ratingProposal(two, await d.repo.childRules(actor.userId));
      if (proposal) {
        await d.repo.proposeRule({ familyId: actor.familyId, childId: actor.userId, text: proposal.text, source: "child_rating",
          sourceKey: proposal.sourceKey, sourceIds: two.map((x) => x.id), now: d.now });
      }
    } catch (e) {
      console.error("rating rule proposal failed", e instanceof Error ? e.message : "unknown");
    }
  }
  return { status: 200, json: { status: r } };
}

/** The math_check of the answer the child saw that confirmed the child's final answer (§4.12 gate). */
function confirmingCheck(tools: readonly ToolRecord[]): ChildCheck | null {
  const t = [...tools].reverse().find((x) => {
    const out = x.output as { ok?: boolean; result?: Record<string, unknown> } | null;
    return x.tool === "math_check" && x.ok && out?.ok === true
      && (out.result?.equivalent === true || out.result?.is_root === true || out.result?.satisfies === true);
  });
  if (!t) return null;
  const input = (t.input ?? {}) as Record<string, unknown>;
  return { mode: String(input.mode ?? ""), input };
}

async function referenceFor(d: Deps, actor: ChildActor, problemId: string, statement: string, childCheck: ChildCheck): Promise<void> {
  try {
    const r = await writeReference({ client: d.client, model: d.models.main, prompt: d.layers.reference ?? "", cas: d.cas },
      { statement, grade: actor.grade, childCheck });
    await d.repo.saveReference({ familyId: actor.familyId, childId: actor.userId, problemId, call: r.call, reference: r.reference,
      promptVersion: d.promptVersion, now: d.now });
  } catch (e) {
    console.error("reference failed", e instanceof Error ? e.message : "unknown");
  }
}

/** D23: one money push through the Launcher; marked as sent only when it went out. Never breaks the turn. */
async function moneyAlert(d: Deps, familyId: string, kind: "economy" | "console_blocked" | "burn", forecastUsd?: number): Promise<void> {
  if (!d.notify) return;
  try {
    if (await d.notify(kind, familyId, forecastUsd)) await d.repo.markAlert(familyId, kind === "console_blocked" ? "console" : kind, d.now);
  } catch (e) {
    console.error("money alert failed", e instanceof Error ? e.message : "unknown");
  }
}

/**
 * G6b. Y2: "Em hiểu rồi" under a card → the card's approved questions join the review queue (due tomorrow).
 * §4.11: a real mistake on a lesson reopens its retired questions. Never breaks the child's turn.
 */
async function reviewQueue(d: Deps, actor: ChildActor, problem: ProblemRow, e: { cardOk: boolean; wrongOn: string | null }): Promise<void> {
  try {
    const last = e.cardOk ? lastCardOf(problem.thread) : null;
    const c = last ? cardOf(last.code) : null;
    if (c && cardFitsGrade(c, actor.grade)) await d.repo.addReviewItems({ actor, items: reviewItemsFromCard(c, dateVn(d.now)), now: d.now });
    if (e.wrongOn) await d.repo.reopenReviews({ childId: actor.userId, kuCode: e.wrongOn, todayVn: dateVn(d.now), now: d.now });
  } catch (err) {
    console.error("review queue failed", err instanceof Error ? err.message : "unknown");
  }
}

/** G7: the Launcher's "cần chú ý" lines follow every turn (G8-fix4). Never breaks the child's turn. */
async function syncAttention(d: Deps, actor: ChildActor): Promise<void> {
  try {
    await d.repo.syncAttention({ familyId: actor.familyId, childId: actor.userId, dateVn: dateVn(d.now), now: d.now });
  } catch (e) {
    console.error("attention sync failed", e instanceof Error ? e.message : "unknown");
  }
}

const closed = (status: ProblemStatus): Result => ({ status: 409, json: { error: "problem_closed", status } });

/** The problem as the server knows it, for "the card example must not use the child's numbers" (C1). */
const problemTextOf = (p: ProblemRow) => p.confirmedStatement ?? p.statement ?? "";

const scriptedFor = (actor: ChildActor, p: ProblemRow, text: string, kind: InputKind): Scripted | null =>
  scriptedTurn({ text, kind, grade: actor.grade, lastCard: lastCardOf(p.thread), problemText: problemTextOf(p) });

async function saveScripted(d: Deps, actor: ChildActor, problem: ProblemRow, s: Scripted): Promise<Result> {
  const reply = await d.repo.saveScriptedReply({ actor, problem, message: s.message, buttons: s.buttons,
    cardRef: s.kind === "card" ? s.cardRef : null, now: d.now });
  return { status: 200, json: { ...reply, planTicks: problem.planTicks } };
}

async function runScripted(d: Deps, actor: ChildActor, problem: ProblemRow, clientMsgId: string, text: string, kind: InputKind,
  s: Scripted): Promise<Result> {
  if (problem.pending) {
    if (!isStale(problem.pending, d.now)) return pending;
    await d.repo.deleteMessage(problem.pending.messageId);
  }
  const claim = await d.repo.insertChildMessage({ actor, problemId: problem.id, clientMsgId, text, inputKind: kind, now: d.now });
  if ("conflict" in claim) return pending;
  return saveScripted(d, actor, problem, s);
}

async function runTurn(d: Deps, actor: ChildActor, problem: ProblemRow, clientMsgId: string, text: string, kind: InputKind,
  photo: Photo | null): Promise<Result> {
  if (problem.pending) {
    if (!isStale(problem.pending, d.now)) return pending; // one turn at a time per problem
    await d.repo.deleteMessage(problem.pending.messageId);
  }
  const claim = await d.repo.insertChildMessage({ actor, problemId: problem.id, clientMsgId, text, inputKind: kind, now: d.now });
  if ("conflict" in claim) return pending;
  if (photo) {
    try {
      await d.repo.saveImage({ actor, problemId: problem.id, messageId: claim.messageId, ...photo, now: d.now });
    } catch (e) {
      console.error("photo upload failed", e instanceof Error ? e.message : "unknown");
      await d.repo.deleteMessage(claim.messageId);
      return busy;
    }
  }
  return runClaimed(d, actor, { ...problem, imageCount: problem.imageCount + (photo ? 1 : 0) }, claim.messageId, text, kind);
}

type Answer = Awaited<ReturnType<typeof runTutorTurn>>;
type TurnTool = ToolRecord & { callIndex: number };

/** What the checker is told about the tools of an answer (guard rules 6–7 need the results, not just names). */
export function toolSummary(t: ToolRecord): string {
  const out = t.output as { ok?: boolean; error?: string; result?: Record<string, unknown> } & Record<string, unknown>;
  if (t.tool === "math_check") {
    const mode = (t.input as { mode?: string } | null)?.mode ?? "?";
    if (!out?.ok) return `math_check(${mode} → error: ${out?.error ?? "unknown"})`;
    const r = Object.entries(out.result ?? {}).filter(([, v]) => typeof v === "boolean").map(([k, v]) => `${k}=${v}`).join(", ");
    return `math_check(${mode} → ${r || "ok"})`;
  }
  if (t.tool === "make_sibling") return `make_sibling(verified=${out?.verified === true}, numbers_differ=${out?.numbers_differ === true})`;
  if (t.tool === "lookup") {
    const code = (t.input as { code?: string } | null)?.code ?? "?";
    return `lookup(${code} → ${t.ok ? "ok" : `error: ${out?.error ?? "unknown"}`})`;
  }
  return `${t.tool}(error)`;
}
const confirmsAnswer = (tools: readonly ToolRecord[]) =>
  checksFrom(tools).some((c) => c.ok && (c.result?.equivalent === true || c.result?.is_root === true || c.result?.satisfies === true));

const CAS_TOOLS = ["math_check", "make_sibling"] as const;

/** The code of the card an answer names, when it is an approved card of the child's grade (else null). */
function approvedCard(code: string | null | undefined, grade: 6 | 9): string | null {
  const c = code ? cardOf(code) : null;
  return c && cardFitsGrade(c, grade) ? c.code : null;
}

const tutorRec = (model: string, a: Answer, reason: RouteReason | null): ModelCallRecord => ({
  purpose: "tutor", model, raw: a.raw, costUsd: a.costUsd, tokens: a.tokens, routeReason: reason,
  guardResult: null, guardReasons: [], shown: false,
});
const siblingRec = (c: SiblingCall): ModelCallRecord => ({
  purpose: "sibling", model: c.model, raw: c.raw, costUsd: c.costUsd, tokens: c.tokens, routeReason: null,
  guardResult: null, guardReasons: [], shown: false,
});
const guardRec = (g: GuardResult): ModelCallRecord => ({
  purpose: "guard", model: g.model, raw: g.raw, costUsd: g.costUsd, tokens: g.tokens, routeReason: null,
  guardResult: null, guardReasons: g.reasons, shown: false,
});

async function runClaimed(d: Deps, actor: ChildActor, problem: ProblemRow, messageId: string, text: string, kind: InputKind): Promise<Result> {
  const turn = problem.turnCount + 1;
  const submitted = kind === "submit";
  const clock = d.clock ?? Date.now;
  const started = clock();
  const left = () => TURN_BUDGET_MS - (clock() - started);

  // 1. Nản (DOMAIN §4.2) on everything the child sent so far, this message included.
  const thread = problem.thread.some((m) => m.id === messageId)
    ? problem.thread
    : [...problem.thread, { id: messageId, role: "child" as const, content: text, inputKind: kind }];
  const nan = isNanSignal(childEvents(thread));
  // 2. Hint level before the call: nản jumps to H4 (§4.1 c). After a sibling was shown, wrong again at H4 → H5 (§3.3).
  const pre = applyPreTurn({ hintLevel: problem.hintLevel, hintLevelMax: problem.hintLevelMax, nanJumps: problem.nanJumps,
    afterSibling: problem.siblingShown }, { nan });
  const level = pre.state.hintLevel;

  // 3. Which model (§4.14, D28) — paused at 45 USD/month (D29).
  const usage = await d.repo.monthUsage(actor.familyId, d.now);
  const paused = strongPaused(usage);
  if (paused && usage.mode === "normal") await d.repo.pauseStrong(actor.familyId, d.now);
  if (paused && economyAlertDue({ mode: "economy", economyAlertSentAt: usage.economyAlertSentAt ?? null })) {
    await moneyAlert(d, actor.familyId, "economy"); // §4.5 b: tell the parents once a month (D23)
  }
  // Photos of this problem go back on the child messages they were sent with (G3); later turns read them from the cache.
  const photos = problem.imageCount > 0 ? await d.repo.problemImages(problem.id) : [];

  // 3a. G5: first turn of a problem — SGK lesson, grade 10 exam item (D27), geometry proof. Never blocks the turn.
  const calls: ModelCallRecord[] = [];
  let cls: Classification = EMPTY;
  if (d.classify && problem.kuCode === null && turn === 1 && left() >= CLASSIFY_NEEDS_MS) {
    const r = await classifyProblem(d.client, { model: d.models.light, prompt: d.layers.classify },
      { grade: actor.grade, statement: text !== PHOTO_ONLY_TEXT ? text : null, image: photos[0]?.image });
    cls = r.output;
    if (r.call) calls.push({ purpose: "classify", model: r.call.model, raw: r.call.raw, costUsd: r.call.costUsd, tokens: r.call.tokens,
      routeReason: null, guardResult: null, guardReasons: [], shown: false });
    try {
      await d.repo.setClassification(problem.id, { kuCode: cls.ku_code, examSlot: cls.exam_slot, knowledgeVersion });
    } catch (e) {
      console.error("setClassification failed", e instanceof Error ? e.message : "unknown");
    }
  }
  const kuCode = problem.kuCode ?? cls.ku_code;
  const examSlot = problem.examSlot ?? cls.exam_slot;

  const geometryProof = cls.geometry_proof || problem.lastTutorFlags.includes("geometry_proof");
  const route = pickModel({ grade: actor.grade, hintLevel: level, nan, prevTutorUnsure: problem.lastTutorFlags.includes("tutor_unsure"),
    problemUsedStrong: problem.usedStrong, strongPaused: paused, geometryProof, examSlot });

  // D38: the newest list of jobs of this problem and what the child ticked on it.
  const plan = currentPlan(problem.thread);
  // D36: no math checker at all → "loi"; only the in-app number checker (no algebra service) → "chi_so".
  const casMode = !d.cas ? "loi" : (d.cas as { limited?: boolean }).limited ? "chi_so" : null;
  const photosOf = (id: string): ImageData[] => photos.filter((p) => p.messageId === id).map((p) => p.image);
  // A message that showed a card carries the card text for the tutor (it never sees the child's screen).
  const history: Turn[] = problem.history.map((h) => {
    const shownCard = h.role === "assistant" ? cardForModel(h.cardRef) : null;
    return { role: h.role, content: shownCard ? `${h.content}\n\n${shownCard}` : h.content, images: photosOf(h.id) };
  });
  // The checker needs the problem: the confirmed restatement, else the typed text, else the first photo.
  const typed = problem.statement && problem.statement !== PHOTO_ONLY_TEXT ? problem.statement : null;
  const guardStatement = problem.confirmedStatement ?? typed ?? (text !== PHOTO_ONLY_TEXT ? text : "(đề trong ảnh, chưa xác nhận)");
  // G8-fix: the checker also sees the photo the child sent with this turn (a figure the tutor comments on).
  const childSaid = thread.filter((m) => m.role === "child").slice(-6).map((m) => `- ${m.content.slice(0, 300)}`).join("\n");
  const guardImages = [...new Set([...(problem.confirmedStatement === null && photos.length ? [photos[0]!.image] : []),
    ...photosOf(messageId)])];

  const { system, messages } = assemble({
    layers: d.layers,
    profileText: withRules(actor.profileText, rulesBlock(await d.repo.rulesForSession(problem.sessionId, actor.userId))),
    knowledgeCard: knowledgeCard(kuCode, actor.grade),
    cardIndex: cardIndexText(actor.grade),
    history,
    childText: text,
    childImages: photosOf(messageId),
    state: {
      grade: actor.grade, hintLevel: level, wrongCount: problem.wrongCount, nan, idle: false, submitted,
      mode: "thuong", minutesLeft: 45, turn, stuckKind: problem.stuckKind, kuCode, examSlot,
      statementConfirmed: problem.statementConfirmed, casMode,
      maxLines: actor.maxLines, bridgeTurns: problem.bridgeTurns,
      lesson: { fromPhoto: typed === null || photosOf(thread.find((m) => m.role === "child")?.id ?? "").length > 0,
        sampleShown: problem.siblingShown || problem.thread.some((m) => m.cardRef?.startsWith("C")), proof: geometryProof,
        plan: plan ? { steps: plan.steps.length, ticked: problem.planTicks } : null },
    },
  });
  // Out of time counts as not passed (fail-closed). The checker sees which tools ran and what they said (rules 6–7).
  // D38: it also reads the list of jobs the tutor wrote (shown under the message), which has its own lines.
  const withPlan = (o: TutorOutput): TutorOutput => o.ke_hoach?.length ? { ...o, message: `${o.message}\n${formatPlan(o.ke_hoach)}` } : o;
  const check = async (o: TutorOutput, tools: readonly ToolRecord[]): Promise<GuardResult | null> => left() < GUARD_NEEDS_MS ? null
    : runGuard(d.client, d.models.light, d.layers.guard, {
      statement: guardStatement, images: guardImages.length ? guardImages : undefined, hintLevel: level, submitted,
      maxLines: linesAllowed(o, sampleChecked(tools), actor.maxLines) + (o.ke_hoach?.length ? o.ke_hoach.length + 1 : 0), output: withPlan(o),
      toolsCalled: tools.map(toolSummary),
      // G8-fix2 (D35): the checker sees the child's message (a number the child gave is not a leak) and knows when
      // the answer shows an approved card (a card is not a sibling problem; it was blocked as one in real use).
      childText: childSaid, card: approvedCard(o.the_hien, actor.grade),
    });
  const noTime = ["out_of_time"];

  // 4. An answer = the tool loop (math_check, make_sibling; ≤ 3 rounds). DOMAIN §4.12 b: a self_solved proposal
  //    on a submitted answer without a confirming math_check is sent back once to call it.
  const turnTools: TurnTool[] = [];
  const review = (o: TutorOutput | null, tools: readonly ToolRecord[]) =>
    submitted && o?.ket_qua_bai === "self_solved" && !confirmsAnswer(tools)
      ? "Em đã nộp bài. Cô gọi math_check cho đáp số cuối của em trước khi kết luận (không nói đáp số ra)." : null;
  async function answer(tier: ModelTier, reason: RouteReason | null, msgs: Msg[]):
    Promise<{ loop: LoopResult; finalRec: ModelCallRecord }> {
    const siblingCalls: SiblingCall[] = [];
    const run = async (name: string, input: unknown) => {
      if (name === "math_check") return runMathCheck(d.cas, input);
      if (name === "lookup") return runLookup(input);
      if (name === "make_sibling") {
        if (left() < SIBLING_NEEDS_MS) return { ok: false, output: { error: "no_time" } };
        try {
          const r = await makeSibling({ client: d.client, model: d.models.main, prompt: d.layers.sibling, cas: d.cas }, input as SiblingInput);
          siblingCalls.push(...r.calls);
          return { ok: true, output: r.output };
        } catch (e) {
          // A broken sibling never costs the child's turn (G0 18/11): the tutor goes on without one.
          console.error("make_sibling failed", e instanceof Error ? e.message : "unknown");
          return { ok: false, output: { error: "sibling_failed" } };
        }
      }
      return { ok: false, output: { error: "unknown_tool" } };
    };
    // G8-fix2: without the math checker the two tools that need it are not offered (in real use the tutor called
    // math_check twice a turn and got "cas_not_configured" each time; the state block says `may_tinh: loi`).
    const loop = await runToolLoop(d.client, { model: d.models[tier], system, messages: msgs, run, timeLeft: left, review,
      withoutTools: casMode === "loi" ? CAS_TOOLS : undefined });
    const recs = loop.calls.map((c) => tutorRec(d.models[tier], c, reason));
    calls.push(...recs);
    const finalIndex = calls.length - 1;
    calls.push(...siblingCalls.map(siblingRec));
    turnTools.push(...loop.tools.map((t) => ({ ...t, callIndex: finalIndex })));
    return { loop, finalRec: recs.at(-1)! };
  }

  let first: Awaited<ReturnType<typeof answer>>;
  try {
    first = await answer(route.tier, route.reason, messages);
  } catch (e) {
    console.error("tutor model call failed", e instanceof Error ? e.message : "unknown"); // never the child's text
    await d.repo.deleteMessage(messageId);
    if (isSpendLimitError(e)) {
      // §4.5 d: the Console stopped the API at the monthly limit. Parents: once a VN day (D23).
      if (consoleAlertDue(usage.consoleAlertSentAt ?? null, d.now)) await moneyAlert(d, actor.familyId, "console_blocked");
      return spendPaused;
    }
    return busy;
  }

  // 5. The checker (fail-closed), one rewrite on the strong model, else a safe line (§5).
  let shown: TutorOutput | null = null;
  let shownTools: readonly ToolRecord[] = [];
  const firstOut = first.loop.final.output;
  const g1 = firstOut ? await check(firstOut, first.loop.tools) : null;
  if (g1) calls.push(guardRec(g1));
  if (firstOut && g1?.pass) {
    shown = firstOut;
    shownTools = first.loop.tools;
    Object.assign(first.finalRec, { guardResult: "pass", shown: true });
  } else {
    first.finalRec.guardResult = "blocked";
    first.finalRec.guardReasons = g1?.reasons ?? (firstOut ? noTime : ["unreadable_output"]);
    const rw = rewriteRoute(paused, route.tier);
    const why = (g1?.reasons.length ? g1.reasons : ["câu trả lời không đúng khuôn JSON"]).join("; ");
    const retry: Msg[] = [...messages, { role: "assistant", content: first.loop.final.raw || "(trống)" },
      { role: "user", content: `[BỘ KIỂM TRA CỦA APP] Câu trả lời vừa rồi chưa gửi được cho em vì: ${why}. Cô viết lại lượt này, giữ đúng luật cứng.` }];
    let second: Awaited<ReturnType<typeof answer>> | null = null;
    if (left() >= REWRITE_NEEDS_MS) {
      try {
        second = await answer(rw.tier, rw.reason, retry);
      } catch (e) {
        console.error("tutor rewrite failed", e instanceof Error ? e.message : "unknown");
      }
    }
    if (second) {
      const out2 = second.loop.final.output;
      const g2 = out2 ? await check(out2, second.loop.tools) : null;
      if (g2) calls.push(guardRec(g2));
      if (out2 && g2?.pass) {
        shown = out2;
        shownTools = second.loop.tools;
        Object.assign(second.finalRec, { guardResult: "rewritten", shown: true });
      } else {
        Object.assign(second.finalRec, { guardResult: "blocked", guardReasons: g2?.reasons ?? (out2 ? noTime : ["unreadable_output"]) });
      }
    }
  }

  // 6. Server rules after the answer: next hint level (§4.1), outcome (§4.12 gate, §5 off-topic, D15).
  // D36: a turn with no answer through the checker still counts "khong_biet" when the child said so (it stayed at H0).
  const verdict = shown?.danh_gia_luot_em ?? (saysNoIdea(text) ? "khong_biet" : "khong_ap_dung");
  const next = nextHintLevel(pre.state, verdict);
  const outcome = decideOutcome({ turn, output: shown, submitted, offtopicCount: problem.offtopicCount,
    checks: checksFrom(shownTools),
    // Grade 9: G4 Q2 (phụ huynh chốt 15/11). Grade 6: DOMAIN §4.10b (phụ huynh chốt 18/11).
    checklistRequired: true,
    checklistAsked: [...new Set([...problem.checklistAsked, ...(shown?.checklist_da_hoi ?? [])])] });
  // G8-fix: never the same safe line twice in a row. G8-fix2: no "read the problem again" once it is confirmed.
  const safe = safeLine(level, safeLinesInARow(problem.history), problem.statementConfirmed);
  // G6 (§4.15): the tutor names an approved card; the server picks the way (C1) and shows it word for word.
  // D36: no answer got through → the lesson's approved card (not shown before in this problem) instead of a safe line.
  const shownCodes = problem.thread.map((m) => m.cardRef?.split("#")[0]).filter((c): c is string => !!c);
  const named = shown?.the_hien ? cardOf(shown.the_hien) : !shown ? lessonCard(kuCode, actor.grade, shownCodes) : null;
  const way = named && cardFitsGrade(named, actor.grade) && outcome.status === "in_progress"
    ? pickVariant(named, 1, problemTextOf(problem) || text) : null;
  const cardRef = named && way ? `${named.code}#${way}` : null;
  // D38: the list of jobs ("Bài của em"). An approved card with jobs, shown as the worked example, brings its own;
  // else the tutor's list when it gives nothing away (only the problem's numbers). A new list replaces the old one.
  const planSteps = !shown || outcome.status !== "in_progress" ? null
    : cardRef && named?.steps && (named.kind === "cach_lam" || shown.ky_thuat === "bai_mau") ? named.steps
      : validPlan(shown.ke_hoach, problemTextOf(problem) || text);
  const redo = plan && !planSteps ? [...new Set(shown?.viec_can_lam_lai ?? [])].filter((n) => n <= plan.steps.length) : [];
  // G5: the lesson code may change when the tutor confirms the statement (or when it was unknown); background gaps (§4.13).
  const confirmsNow = !problem.statementConfirmed && shown?.de_da_xac_nhan === true;
  const proposed = shown?.ku_code_de_xuat ?? null;
  const newKu = proposed && proposed !== kuCode && codeFitsGrade(proposed, actor.grade) && (kuCode === null || confirmsNow) ? proposed : kuCode;
  const gap = shown?.prereq_gap && codeFitsGrade(shown.prereq_gap, actor.grade) ? shown.prereq_gap : null;
  const diagnoses: Diagnosis[] = [];
  if (gap) diagnoses.push({ root: "concept", source: shown?.goc_loi_da_kiem_tra ? "verified" : "self_reported", kuCode: gap });
  else if (shown?.goc_loi_da_kiem_tra && shown.goc_loi_du_doan) diagnoses.push({ root: shown.goc_loi_du_doan, source: "verified", kuCode: newKu });
  const saved = await d.repo.saveReply({
    actor, problem, childMessageId: messageId, turn,
    status: outcome.status,
    statementConfirmed: problem.statementConfirmed || shown?.de_da_xac_nhan === true,
    // The tutor's last restatement before the child confirmed it (G3; kept after the photo is deleted, §4.8).
    confirmedStatement: !problem.statementConfirmed && shown?.de_da_xac_nhan === true
      ? (problem.history.filter((h) => h.role === "assistant").at(-1)?.content ?? null) : null,
    replyHintLevel: level,
    hintLevel: next.hintLevel,
    // Y1: a card is H2. D37: a worked example (cách làm) opens every problem, so it is not a hint.
    hintLevelMax: cardRef && named?.kind !== "cach_lam" ? (Math.max(next.hintLevelMax, 2) as HintLevel) : next.hintLevelMax,
    nanJumps: next.nanJumps,
    wrongCount: problem.wrongCount + (verdict === "sai" ? 1 : 0),
    offtopicCount: outcome.offtopicCount,
    uLevel: shown ? (Number(shown.u_level_hien_tai.slice(1)) as 0 | 1 | 2 | 3) : problem.uLevel,
    tutorText: (shown?.message ?? (cardRef ? CARD_FALLBACK_INTRO : safe.message)) + (planSteps ? `\n\n${formatPlan(planSteps)}` : ""),
    // D38: with a list the child works through it; "Em hiểu rồi" (which led to one small question per turn) goes away.
    buttons: cardRef ? (planSteps ? [BTN_CARD_AGAIN] : [...CARD_BUTTONS]) : planSteps ? [] : (shown?.buttons ?? safe.buttons),
    cardRef,
    calls,
    tools: turnTools,
    kuCode: newKu,
    prereqGaps: gap && !problem.prereqGaps.includes(gap) ? [...problem.prereqGaps, gap] : problem.prereqGaps,
    diagnoses,
    promptVersion: d.promptVersion,
    now: d.now,
  });
  if ("conflict" in saved) {
    // Another device saved a turn of this problem meanwhile: drop this message; the client's
    // retry of the same clientMsgId runs it again on top of the newer turn.
    await d.repo.deleteMessage(messageId);
    return pending;
  }
  // G7: the Launcher's "cần chú ý" lines. G8-fix4: also while the problem stays open (children often leave
  // without ending the problem or the session) — after the answer is sent, so the child never waits for it.
  if (saved.status !== "in_progress") await syncAttention(d, actor);
  else if (d.later) d.later(() => syncAttention(d, actor));
  else await syncAttention(d, actor);
  // D38: the jobs the tutor sent back after a wrong answer are unticked.
  for (const n of redo) await d.repo.savePlanEvent({ actor, problemId: problem.id, clientMsgId: null, content: planEventText({ step: n, done: false }), now: d.now });
  const planTicks = planSteps ? [] : applyTicks(problem.planTicks, redo.map((n) => ({ step: n, done: false })));
  await reviewQueue(d, actor, problem, { cardOk: kind === "button" && text === BTN_CARD_OK, wrongOn: verdict === "sai" ? newKu : null });
  if (saved.status === "self_solved") {
    // G4 Q3 / G7 P4: the reference solution, written after the answer and shown only when cas confirms it (X5).
    const childCheck = confirmingCheck(shownTools);
    if (childCheck && d.layers.reference) {
      const work = () => referenceFor(d, actor, problem.id, guardStatement, childCheck);
      if (d.later) d.later(work);
      else await work();
    }
  }
  // §4.5 b2: the month's pace would pass the cap → one push a week (from day 5, X2).
  const forecast = burnAlertDue({ costUsd: usage.costUsd + calls.reduce((n, c) => n + c.costUsd, 0), burnAlertSentAt: usage.burnAlertSentAt ?? null }, d.now);
  if (forecast !== null) await moneyAlert(d, actor.familyId, "burn", forecast);
  return { status: 200, json: { ...saved, planTicks } };
}

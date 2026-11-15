// lib/tutor/handlers.ts — the server side of a tutor turn, pure apart from the injected repo and
// model client (tested in tests/handlers.test.ts). The route files only wire real dependencies.
//
// G2: one turn = nản check → hint level → model choice (Sonnet / Opus) → answer → Haiku checker →
// one rewrite → safe line → next hint level → problem outcome (docs/DESIGN.md §4, DOMAIN §4.1, §4.2,
// §4.14, §5). G4 adds the tools and math_check (until then self_solved is never allowed).
import { z } from "zod";
import type { Actor } from "@/lib/actor";
import { PHOTO_COPY, PHOTO_ONLY_TEXT, SAFE_BUSY, safeLine } from "@/lib/copy";
import { processImage } from "@/lib/images";
import { MAX_IMAGES_PER_PROBLEM } from "@/lib/rules/photo";
import { isTooBig } from "@/lib/tutor/form";
import { childEvents, type InputKind } from "@/lib/rules/events";
import { applyPreTurn, nextHintLevel } from "@/lib/rules/hints";
import { pickModel, rewriteRoute, strongPaused, type ModelTier, type RouteReason } from "@/lib/rules/model";
import { isNanSignal } from "@/lib/rules/nan";
import { decideOutcome } from "@/lib/rules/outcome";
import { dateVn } from "@/lib/time";
import { assemble, type ImageData, type Msg, type SystemBlock, type Turn } from "@/lib/tutor/assemble";
import { runGuard, type GuardResult } from "@/lib/tutor/guard";
import type { Layers } from "@/lib/tutor/layers";
import {
  STUCK_KINDS, type ChildActor, type Device, type ModelCallRecord, type PendingMessage, type ProblemRow, type ProblemStatus, type TutorRepo,
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

const unauthorized: Result = { status: 401, json: { error: "unauthorized" } };
const badRequest: Result = { status: 400, json: { error: "bad_request" } };
const pending: Result = { status: 409, json: { error: "pending" } };
const busy: Result = { status: 503, json: { error: "model_unavailable", message: SAFE_BUSY } };
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
  const s = await d.repo.openSession({ actor, device: dev ?? "laptop", dateVn: dateVn(d.now), promptVersion: d.promptVersion, modelMain: d.models.main });
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
    if (seen.reply) return { status: 200, json: { problemId: seen.problemId, reply: seen.reply } };
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
    promptVersion: d.promptVersion, modelMain: d.models.main });
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
    if (seen.reply) return { status: 200, json: seen.reply };
    if (!isStale({ messageId: seen.messageId, clientMsgId, text: seen.text, at: seen.at }, d.now)) return pending;
    // The first call died before replying: run the turn again with what the child sent then.
    if (problem.status !== "in_progress") return closed(problem.status);
    const stored = problem.thread.find((m) => m.id === seen.messageId)?.inputKind ?? kind;
    return runClaimed(d, actor, problem, seen.messageId, seen.text, stored);
  }
  if (problem.status !== "in_progress") return closed(problem.status);
  if (image && problem.imageCount >= MAX_IMAGES_PER_PROBLEM) return tooMany;
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
  return { status: 200, json: { status: "saved_for_later" } };
}

const closed = (status: ProblemStatus): Result => ({ status: 409, json: { error: "problem_closed", status } });

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

const tutorRec = (model: string, a: Answer, reason: RouteReason | null): ModelCallRecord => ({
  purpose: "tutor", model, raw: a.raw, costUsd: a.costUsd, tokens: a.tokens, routeReason: reason,
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
  // 2. Hint level before the call: nản jumps to H4 (§4.1 c). TODO(G4): afterSibling from the sibling problem (make_sibling).
  const pre = applyPreTurn({ hintLevel: problem.hintLevel, hintLevelMax: problem.hintLevelMax, nanJumps: problem.nanJumps, afterSibling: false }, { nan });
  const level = pre.state.hintLevel;

  // 3. Which model (§4.14, D28) — paused at 45 USD/month (D29).
  const usage = await d.repo.monthUsage(actor.familyId, d.now);
  const paused = strongPaused(usage);
  if (paused && usage.mode === "normal") await d.repo.pauseStrong(actor.familyId, d.now); // TODO(G7): tell the parents (D23)
  const route = pickModel({ grade: actor.grade, hintLevel: level, nan, prevTutorUnsure: problem.lastTutorFlags.includes("tutor_unsure"),
    problemUsedStrong: problem.usedStrong, strongPaused: paused });

  // Photos of this problem go back on the child messages they were sent with (G3); later turns read them from the cache.
  const photos = problem.imageCount > 0 ? await d.repo.problemImages(problem.id) : [];
  const photosOf = (id: string): ImageData[] => photos.filter((p) => p.messageId === id).map((p) => p.image);
  const history: Turn[] = problem.history.map((h) => ({ role: h.role, content: h.content, images: photosOf(h.id) }));
  // The checker needs the problem: the confirmed restatement, else the typed text, else the first photo.
  const typed = problem.statement && problem.statement !== PHOTO_ONLY_TEXT ? problem.statement : null;
  const guardStatement = problem.confirmedStatement ?? typed ?? (text !== PHOTO_ONLY_TEXT ? text : "(đề trong ảnh, chưa xác nhận)");
  const guardImages = problem.confirmedStatement === null && photos.length ? [photos[0]!.image] : undefined;

  const { system, messages } = assemble({
    layers: d.layers,
    profileText: actor.profileText,
    knowledgeCard: null,
    history,
    childText: text,
    childImages: photosOf(messageId),
    state: {
      grade: actor.grade, hintLevel: level, wrongCount: problem.wrongCount, nan, idle: false, submitted,
      mode: "thuong", minutesLeft: 45, turn, stuckKind: problem.stuckKind, kuCode: null, examSlot: null,
      maxLines: actor.maxLines,
    },
  });
  const ask = (tier: ModelTier, msgs: Msg[], sys: SystemBlock[] = system) =>
    runTutorTurn(d.client, { model: d.models[tier], system: sys, messages: msgs });
  // Out of time counts as not passed (fail-closed).
  const check = async (o: TutorOutput): Promise<GuardResult | null> => left() < GUARD_NEEDS_MS ? null : runGuard(d.client, d.models.light, d.layers.guard, {
    statement: guardStatement, images: guardImages, hintLevel: level, submitted, maxLines: actor.maxLines, output: o, toolsCalled: [],
  });
  const noTime = ["out_of_time"];

  // 4. The answer. A failed call releases the child's message so the same resend can run again.
  const calls: ModelCallRecord[] = [];
  let first: Answer;
  try {
    first = await ask(route.tier, messages);
  } catch (e) {
    console.error("tutor model call failed", e instanceof Error ? e.message : "unknown"); // never the child's text
    await d.repo.deleteMessage(messageId);
    return busy;
  }
  const firstRec = tutorRec(d.models[route.tier], first, route.reason);
  calls.push(firstRec);

  // 5. The checker (fail-closed), one rewrite on the strong model, else a safe line (§5).
  let shown: TutorOutput | null = null;
  const g1 = first.output ? await check(first.output) : null;
  if (g1) calls.push(guardRec(g1));
  if (first.output && g1?.pass) {
    shown = first.output;
    Object.assign(firstRec, { guardResult: "pass", shown: true });
  } else {
    firstRec.guardResult = "blocked";
    firstRec.guardReasons = g1?.reasons ?? (first.output ? noTime : ["unreadable_output"]);
    const rw = rewriteRoute(paused);
    const why = (g1?.reasons.length ? g1.reasons : ["câu trả lời không đúng khuôn JSON"]).join("; ");
    const retry: Msg[] = [...messages, { role: "assistant", content: first.raw || "(trống)" },
      { role: "user", content: `[BỘ KIỂM TRA CỦA APP] Câu trả lời vừa rồi chưa gửi được cho em vì: ${why}. Cô viết lại lượt này, giữ đúng luật cứng.` }];
    let second: Answer | null = null;
    if (left() >= REWRITE_NEEDS_MS) {
      try {
        second = await ask(rw.tier, retry);
      } catch (e) {
        console.error("tutor rewrite failed", e instanceof Error ? e.message : "unknown");
      }
    }
    if (second) {
      const secondRec = tutorRec(d.models[rw.tier], second, rw.reason);
      calls.push(secondRec);
      const g2 = second.output ? await check(second.output) : null;
      if (g2) calls.push(guardRec(g2));
      if (second.output && g2?.pass) {
        shown = second.output;
        Object.assign(secondRec, { guardResult: "rewritten", shown: true });
      } else {
        Object.assign(secondRec, { guardResult: "blocked", guardReasons: g2?.reasons ?? (second.output ? noTime : ["unreadable_output"]) });
      }
    }
  }

  // 6. Server rules after the answer: next hint level (§4.1), outcome (§4.12 gate, §5 off-topic, D15).
  const verdict = shown?.danh_gia_luot_em ?? "khong_ap_dung";
  const next = nextHintLevel(pre.state, verdict);
  const outcome = decideOutcome({ turn, output: shown, submitted, offtopicCount: problem.offtopicCount });
  const safe = safeLine(level);
  const saved = await d.repo.saveReply({
    actor, problem, childMessageId: messageId, turn,
    status: outcome.status,
    statementConfirmed: problem.statementConfirmed || shown?.de_da_xac_nhan === true,
    // The tutor's last restatement before the child confirmed it (G3; kept after the photo is deleted, §4.8).
    confirmedStatement: !problem.statementConfirmed && shown?.de_da_xac_nhan === true
      ? (problem.history.filter((h) => h.role === "assistant").at(-1)?.content ?? null) : null,
    replyHintLevel: level,
    hintLevel: next.hintLevel,
    hintLevelMax: next.hintLevelMax,
    nanJumps: next.nanJumps,
    wrongCount: problem.wrongCount + (verdict === "sai" ? 1 : 0),
    offtopicCount: outcome.offtopicCount,
    uLevel: shown ? (Number(shown.u_level_hien_tai.slice(1)) as 0 | 1 | 2 | 3) : problem.uLevel,
    tutorText: shown?.message ?? safe.message,
    buttons: shown?.buttons ?? safe.buttons,
    calls,
    promptVersion: d.promptVersion,
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

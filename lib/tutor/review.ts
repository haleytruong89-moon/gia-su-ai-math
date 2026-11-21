// lib/tutor/review.ts — the start-of-session review (G6b, DOMAIN §4.11, D26). The server grades; the child never sees
// the answer before answering.
import { z } from "zod";
import type { Actor } from "@/lib/actor";
import { REVIEW_COPY } from "@/lib/copy";
import { applyReviewResult, gradeExact, pickDue, type ReviewResult } from "@/lib/rules/review";
import { dateVn } from "@/lib/time";
import type { CasClient } from "@/lib/tools/casClient";
import { runMathCheck } from "@/lib/tools/mathCheck";
import type { ChildActor, StoredReviewItem, TutorRepo } from "@/lib/tutor/repo";

export interface ReviewDeps { repo: TutorRepo; actor: Actor | null; now: Date; cas: CasClient | null }
type Result = { status: number; json: unknown };

/** What the start page shows: ≤ 2 due questions, without their answers. */
export interface DueReview { id: string; kind: StoredReviewItem["kind"]; prompt: string; buttons: string[]; cardCode: string | null }

export async function dueReviews(repo: TutorRepo, childId: string, now: Date): Promise<DueReview[]> {
  const items = await repo.reviewItemsOf(childId);
  const byId = new Map(items.map((i) => [i.id, i]));
  return pickDue(items, dateVn(now)).map((p) => {
    const i = byId.get(p.id)!;
    return { id: i.id, kind: i.kind, prompt: i.prompt, buttons: i.buttons, cardCode: i.cardCode };
  });
}

const body = z.object({
  itemId: z.string().uuid(),
  clientMsgId: z.string().uuid(),
  answer: z.string().trim().max(200).optional(),
  skipped: z.literal(true).optional(),
}).refine((b) => b.skipped === true || (b.answer?.length ?? 0) > 0);

const asChild = (a: Actor | null): ChildActor | null => (a?.role === "child" ? a : null);

/** "correct" / "wrong" / "skipped", or null when the math checker could not say (then nothing changes). */
async function grade(d: ReviewDeps, item: StoredReviewItem, given: string): Promise<ReviewResult | null> {
  if (item.answerCheck === "exact") return gradeExact(given, item.answer) ? "correct" : "wrong";
  const r = await runMathCheck(d.cas, { mode: "equivalent", expr_a: given, expr_b: item.answer });
  const eq = (r.output as { result?: { equivalent?: unknown } }).result?.equivalent;
  return r.ok && typeof eq === "boolean" ? (eq ? "correct" : "wrong") : null;
}

const reply = (result: ReviewResult, item: StoredReviewItem, nextDueVn: string): Result =>
  ({ status: 200, json: { result, answer: result === "skipped" ? null : item.answer, nextDueVn } });

export async function answerReview(d: ReviewDeps, raw: unknown): Promise<Result> {
  const actor = asChild(d.actor);
  if (!actor) return { status: 401, json: { error: "unauthorized" } };
  const parsed = body.safeParse(raw);
  if (!parsed.success) return { status: 400, json: { error: "bad_request" } };
  const { itemId, clientMsgId, answer, skipped } = parsed.data;

  const seen = await d.repo.reviewAttempt(actor.userId, clientMsgId);
  if (seen) {
    const was = await d.repo.reviewItem(seen.itemId, actor.userId);
    return was ? reply(seen.result, was, was.dueDateVn) : { status: 404, json: { error: "not_found" } };
  }
  const item = await d.repo.reviewItem(itemId, actor.userId);
  if (!item) return { status: 404, json: { error: "not_found" } };
  const today = dateVn(d.now);
  // Only an active question that is due can be answered (no retiring a question early by answering it again).
  if (item.status !== "active" || item.dueDateVn > today) return { status: 409, json: { error: "not_due" } };

  const result = skipped ? "skipped" : await grade(d, item, answer!);
  if (!result) return { status: 200, json: { result: "unchecked", answer: null, message: REVIEW_COPY.unchecked } };
  const next = applyReviewResult(item, result, today);
  const saved = await d.repo.saveReviewAnswer({ actor, item, next, result, answer: skipped ? null : answer!, clientMsgId, now: d.now });
  if (saved === "already") {
    const again = await d.repo.reviewAttempt(actor.userId, clientMsgId);
    const was = await d.repo.reviewItem(item.id, actor.userId);
    if (again && was) return reply(again.result, was, was.dueDateVn);
  }
  return reply(result, item, next.dueDateVn);
}

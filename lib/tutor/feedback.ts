// lib/tutor/feedback.ts — "Cô sai ở đây" (D32): the child flags one tutor message, says what kind of mistake it was and
// why. Stored for the parents' evening report; never shown to the tutor model, never changes the problem.
import { z } from "zod";
import type { Actor } from "@/lib/actor";
import { FEEDBACK_COMMENT_MAX, FEEDBACK_KINDS, parseMessageRef } from "@/lib/rules/feedback";
import type { ChildActor, TutorRepo } from "@/lib/tutor/repo";

export interface FeedbackDeps { repo: TutorRepo; actor: Actor | null; now: Date }
type Result = { status: number; json: unknown };

const body = z.object({
  messageRef: z.string().min(1).max(80),
  kind: z.enum(FEEDBACK_KINDS),
  comment: z.string().max(FEEDBACK_COMMENT_MAX).nullish(),
  clientMsgId: z.string().uuid(),
});

const asChild = (a: Actor | null): ChildActor | null => (a?.role === "child" ? a : null);

export async function flagMessage(d: FeedbackDeps, raw: unknown): Promise<Result> {
  const actor = asChild(d.actor);
  if (!actor) return { status: 401, json: { error: "unauthorized" } };
  const parsed = body.safeParse(raw);
  if (!parsed.success) return { status: 400, json: { error: "bad_request" } };
  const ref = parseMessageRef(parsed.data.messageRef);
  // Another child's message, the child's own message, or an unknown id all look the same: not found.
  const msg = ref && (await d.repo.tutorMessageFor(actor.userId, ref));
  if (!msg) return { status: 404, json: { error: "not_found" } };
  const status = await d.repo.saveMessageFeedback({ actor, problemId: msg.problemId, messageId: msg.id, kind: parsed.data.kind,
    comment: parsed.data.comment?.trim() || null, clientMsgId: parsed.data.clientMsgId, now: d.now });
  return { status: 200, json: { status } };
}

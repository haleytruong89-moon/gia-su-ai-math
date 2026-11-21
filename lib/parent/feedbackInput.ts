// lib/parent/feedbackInput.ts — the body of POST /api/parent/feedback (👍/👎 + note on one tutor turn). Pure.
import { z } from "zod";

export const MAX_NOTE_CHARS = 500;
const body = z.object({
  problemId: z.uuid(),
  messageId: z.uuid(),
  thumb: z.enum(["up", "down"]),
  note: z.string().max(MAX_NOTE_CHARS).optional(),
}).strict();

export interface FeedbackInput { problemId: string; messageId: string; thumb: "up" | "down"; note: string | null }

export function parseFeedback(raw: unknown): FeedbackInput | null {
  const r = body.safeParse(raw);
  if (!r.success) return null;
  const note = r.data.note?.trim() || null;
  return { problemId: r.data.problemId, messageId: r.data.messageId, thumb: r.data.thumb, note };
}

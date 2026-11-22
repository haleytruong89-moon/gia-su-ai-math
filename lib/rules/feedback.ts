// lib/rules/feedback.ts — the child flags one tutor message ("Cô sai ở đây", D32). Parents read it in the evening
// report; the tutor model never sees it. Pure helpers, shared by the server, the chat and the report.

export const FEEDBACK_KINDS = ["wrong", "gave_answer", "unclear", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** Button text for the child, and the label in the parents' report. */
export const FEEDBACK_LABEL: Record<FeedbackKind, string> = {
  wrong: "Cô nói sai",
  gave_answer: "Cô đưa đáp số",
  unclear: "Khó hiểu",
  other: "Khác",
};

export const FEEDBACK_COMMENT_MAX = 500;

/**
 * How the chat names a tutor message: its database id after a reload, or "<child clientMsgId>-reply" for a
 * reply that arrived in this page. The server resolves both and only accepts a TUTOR message of the child's own problem.
 */
export type MessageRef = { kind: "id"; id: string } | { kind: "replyTo"; clientMsgId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseMessageRef(ref: string): MessageRef | null {
  const reply = /^(.+)-reply$/.exec(ref);
  if (reply && UUID.test(reply[1]!)) return { kind: "replyTo", clientMsgId: reply[1]! };
  return UUID.test(ref) ? { kind: "id", id: ref } : null;
}

export interface FeedbackItem {
  problemId: string;
  kind: FeedbackKind;
  /** What the tutor said (shortened for the report). */
  tutorText: string;
  comment: string | null;
  at: string;
}

/** The parents paste this into a chat with Claude; no names (grade only), no photos. */
export function feedbackRequest(grade: number | null, date: string, items: readonly FeedbackItem[]): string {
  const head = `Con${grade ? ` lớp ${grade}` : ""} báo cô sai (${date}), ${items.length} chỗ. Nhờ Claude xem, đưa thành ca test (dữ liệu giả) và sửa:`;
  const lines = items.map((f, i) =>
    `${i + 1}. [${FEEDBACK_LABEL[f.kind]}] Cô nói: «${f.tutorText}»${f.comment ? `\n   Con viết: «${f.comment}»` : ""}`);
  return [head, ...lines].join("\n");
}

export const shorten = (s: string, n = 300) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

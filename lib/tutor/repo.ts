// lib/tutor/repo.ts — what the server handlers need from storage. Two implementations:
// lib/db/supabaseRepo.ts (schema tutor, service role) and tests/helpers/memoryRepo.ts.
import type { Actor } from "@/lib/actor";
import type { Msg } from "@/lib/tutor/assemble";

export type ChildActor = Extract<Actor, { role: "child" }>;
export type Device = "ipad" | "boox" | "laptop";
export const STUCK_KINDS = ["chua_hieu_de", "khong_biet_bat_dau", "lam_do_thi_tac", "ra_ket_qua_sai", "khong_hieu_buoc"] as const;
export type StuckKind = (typeof STUCK_KINDS)[number];
export type ProblemStatus =
  | "in_progress" | "self_solved" | "pending_review" | "saved_for_later" | "closed_offtopic" | "abandoned" | "timed_out";

/** The child message of a turn that has no tutor reply yet. */
export interface PendingMessage { messageId: string; clientMsgId: string | null; text: string; at: Date }

export interface ProblemRow {
  id: string;
  childId: string;
  familyId: string;
  sessionId: string;
  status: ProblemStatus;
  turnCount: number;
  hintLevel: number;
  wrongCount: number;
  stuckKind: StuckKind | null;
  statementConfirmed: boolean;
  /** Answered turns only, oldest first (child = user, tutor = assistant). */
  history: Msg[];
  pending: PendingMessage | null;
}

/** What the child's screen shows after a turn (also the idempotent answer to a resend). */
export interface StoredReply {
  problemId: string;
  message: string;
  buttons: string[];
  hintLevel: number;
  status: ProblemStatus;
  turnCount: number;
}

export interface FoundMessage { problemId: string; messageId: string; text: string; at: Date; reply: StoredReply | null }

export interface SaveReplyInput {
  actor: ChildActor;
  problem: ProblemRow;
  childMessageId: string;
  turn: number;
  status: ProblemStatus;
  statementConfirmed: boolean;
  tutorText: string;
  buttons: string[];
  rawOutput: string;
  model: string;
  promptVersion: string;
  costUsd: number;
  tokens: { in: number; cached: number; out: number };
  now: Date;
}

export interface TutorRepo {
  /**
   * The child's active session of `dateVn`, or a new one. An active one from an earlier day is
   * marked abandoned, with its open problems (DOMAIN §3.1–3.2).
   */
  openSession(a: { actor: ChildActor; device: Device; dateVn: string; promptVersion: string; modelMain: string }): Promise<{ id: string; reused: boolean }>;
  createProblem(a: { actor: ChildActor; sessionId: string; stuckKind: StuckKind | null }): Promise<{ id: string }>;
  setProblemStatus(problemId: string, status: ProblemStatus, now: Date): Promise<void>;
  /** null when the problem does not exist or belongs to another child. */
  getProblemForChild(problemId: string, childId: string): Promise<ProblemRow | null>;
  /** The child's message with this client id, with the tutor reply that followed it (if any). */
  findByClientMsg(childId: string, clientMsgId: string): Promise<FoundMessage | null>;
  /** Inserts the child's message; `conflict` when the client id was already used (a resend in flight). */
  insertChildMessage(a: { actor: ChildActor; problemId: string; clientMsgId: string; text: string; now: Date }): Promise<{ messageId: string } | { conflict: true }>;
  /** Frees a claimed child message when the model call failed, so the same resend can run again. */
  deleteMessage(messageId: string): Promise<void>;
  /**
   * Problem counters first, guarded by the turn count read before the model call (optimistic lock):
   * `conflict` when another turn of this problem was saved meanwhile (two devices). Then the tutor
   * message, the model_call and the monthly cost. The cost is recorded even on a conflict.
   */
  saveReply(a: SaveReplyInput): Promise<StoredReply | { conflict: true }>;
}

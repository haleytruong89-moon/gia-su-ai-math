// lib/tutor/repo.ts — what the server handlers need from storage. Two implementations:
// lib/db/supabaseRepo.ts (schema tutor, service role) and tests/helpers/memoryRepo.ts.
import type { Actor } from "@/lib/actor";
import type { HintLevel } from "@/lib/rules/hints";
import type { InputKind, StoredMsg } from "@/lib/rules/events";
import type { RouteReason } from "@/lib/rules/model";
import type { ToolRecord } from "@/lib/tools/defs";
import type { ImageData } from "@/lib/tutor/assemble";

export type ChildActor = Extract<Actor, { role: "child" }>;
/** An answered message of the problem; `id` lets the server put the message's photos back (never sent to the API). */
export type HistoryItem = { id: string; role: "user" | "assistant"; content: string };
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
  hintLevel: HintLevel;
  hintLevelMax: HintLevel;
  nanJumps: number;
  wrongCount: number;
  offtopicCount: number;
  uLevel: 0 | 1 | 2 | 3;
  stuckKind: StuckKind | null;
  statementConfirmed: boolean;
  /** The tutor's restatement the child confirmed (G3); also what remains after the photo file is deleted. */
  confirmedStatement: string | null;
  /** Answered turns only, oldest first (child = user, tutor = assistant). */
  history: HistoryItem[];
  /** Every child/tutor message with how it was sent (for the nản rule, DOMAIN §4.2). */
  thread: StoredMsg[];
  /** The first child message: the problem as the child typed it (for the checker). */
  statement: string | null;
  /** A tutor call of this problem already ran on the strong model (D28: stay on it). */
  usedStrong: boolean;
  /** `flags` of the last answer the child saw (from model_calls.raw_output). */
  lastTutorFlags: string[];
  /** Photos already stored for this problem (at most MAX_IMAGES_PER_PROBLEM). */
  imageCount: number;
  /** A machine-checked sibling problem was part of an answer the child saw (G4: H4 → H5, DOMAIN §3.3). */
  siblingShown: boolean;
  /** Checklist items (§4.10) asked in the answers the child saw (G4 Q2). */
  checklistAsked: number[];
  /** G5: SGK lesson of the problem (classifier, then the tutor at confirmation), grade 10 exam item (D27), background gaps (§4.13). */
  kuCode: string | null;
  examSlot: string | null;
  prereqGaps: string[];
  /** Answers the child saw, at the end of the problem, with ky_thuat = day_bu_nen (§4.13: at most 2 in a row). */
  bridgeTurns: number;
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
  statementConfirmed: boolean;
}

export interface FoundMessage { problemId: string; messageId: string; text: string; at: Date; reply: StoredReply | null }

/** One model call of a turn: the tutor answer(s) and the checker verdict(s). */
export interface ModelCallRecord {
  purpose: "tutor" | "guard" | "sibling" | "classify";
  model: string;
  raw: string;
  costUsd: number;
  tokens: { in: number; cached: number; out: number };
  routeReason: RouteReason | null;
  guardResult: "pass" | "rewritten" | "blocked" | null;
  guardReasons: string[];
  /** true for the call whose text the child sees (it gets message_id) */
  shown: boolean;
}

export interface SaveReplyInput {
  actor: ChildActor;
  problem: ProblemRow;
  childMessageId: string;
  turn: number;
  status: ProblemStatus;
  statementConfirmed: boolean;
  /** written once, on the turn where statementConfirmed becomes true */
  confirmedStatement: string | null;
  /** the level this answer was written at (after a nản jump); stored on the tutor message */
  replyHintLevel: HintLevel;
  /** the problem's level for the next turn (after the child's answer was judged) */
  hintLevel: HintLevel;
  hintLevelMax: HintLevel;
  nanJumps: number;
  wrongCount: number;
  offtopicCount: number;
  uLevel: 0 | 1 | 2 | 3;
  tutorText: string;
  buttons: string[];
  calls: ModelCallRecord[];
  /** tools run for the answers of this turn; `callIndex` = index in `calls` of the answer (final call) they served */
  tools: (ToolRecord & { callIndex: number })[];
  /** G5: KU to store (unchanged = problem.kuCode), the whole new list of background gaps, diagnoses of this answer. */
  kuCode: string | null;
  prereqGaps: string[];
  diagnoses: Diagnosis[];
  promptVersion: string;
  now: Date;
}

export type DiagnosisRoot = "read" | "concept" | "strategy" | "calc" | "careful" | "unknown";
export interface Diagnosis { root: DiagnosisRoot; source: "verified" | "self_reported"; kuCode: string | null }

/** The family's spend this UTC month (like the Anthropic Console) and whether the strong model is paused. */
export interface MonthUsage { costUsd: number; mode: "normal" | "economy" }

export interface TutorRepo {
  /**
   * The child's active session of `dateVn`, or a new one. An active one from an earlier day is
   * marked abandoned, with its open problems (DOMAIN §3.1–3.2).
   */
  openSession(a: { actor: ChildActor; device: Device; dateVn: string; promptVersion: string; modelMain: string }): Promise<{ id: string; reused: boolean }>;
  createProblem(a: { actor: ChildActor; sessionId: string; stuckKind: StuckKind | null }): Promise<{ id: string }>;
  setProblemStatus(problemId: string, status: ProblemStatus, now: Date): Promise<void>;
  /** G5: what the classifier said on the first turn, with the knowledge version the problem uses. */
  setClassification(problemId: string, c: { kuCode: string | null; examSlot: string | null; knowledgeVersion: string }): Promise<void>;
  /** null when the problem does not exist or belongs to another child. */
  getProblemForChild(problemId: string, childId: string): Promise<ProblemRow | null>;
  /** The child's message with this client id, with the tutor reply that followed it (if any). */
  findByClientMsg(childId: string, clientMsgId: string): Promise<FoundMessage | null>;
  /** Inserts the child's message; `conflict` when the client id was already used (a resend in flight). */
  insertChildMessage(a: { actor: ChildActor; problemId: string; clientMsgId: string; text: string; inputKind: InputKind; now: Date }): Promise<{ messageId: string } | { conflict: true }>;
  /** Frees a claimed child message when the model call failed, so the same resend can run again (its photos go too). */
  deleteMessage(messageId: string): Promise<void>;
  /** Stores a cleaned JPEG sent with a child message: Storage upload, then the attachments row. */
  saveImage(a: { actor: ChildActor; problemId: string; messageId: string; jpeg: Buffer; width: number; height: number;
    device: Device; now: Date }): Promise<void>;
  /** Every photo of the problem, oldest first, with the child message it was sent with (base64 for the model). */
  problemImages(problemId: string): Promise<{ messageId: string; image: ImageData }[]>;
  /** Retake (G3 Q3): the replaced problem is abandoned only if it is this child's, open and not confirmed. */
  abandonUnconfirmed(problemId: string, childId: string, now: Date): Promise<boolean>;
  /**
   * Problem counters first, guarded by the turn count read before the model call (optimistic lock):
   * `conflict` when another turn of this problem was saved meanwhile (two devices). Then the tutor
   * message, the model_calls and the monthly cost. The cost of every call is recorded even on a conflict.
   */
  saveReply(a: SaveReplyInput): Promise<StoredReply | { conflict: true }>;
  monthUsage(familyId: string, now: Date): Promise<MonthUsage>;
  /** usage_monthly.model_mode = 'economy': no strong model until next month (D29). */
  pauseStrong(familyId: string, now: Date): Promise<void>;
  /**
   * "Để dành hỏi thầy" (DOMAIN §3.2): records the child's press and closes the problem as
   * saved_for_later. `already` for a resend of the same press; `not_open` when the problem is closed.
   */
  saveForLater(a: { actor: ChildActor; problemId: string; clientMsgId: string; now: Date }): Promise<"saved" | "already" | "not_open">;
}

/** `flags` of a stored tutor answer (model_calls.raw_output); [] when it is not readable. */
export function flagsOf(raw: string): string[] {
  try {
    const f = (JSON.parse(raw) as { flags?: unknown }).flags;
    return Array.isArray(f) ? f.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** checklist_da_hoi of a stored tutor answer; [] when it is not readable. */
export function checklistOf(raw: string): number[] {
  try {
    const c = (JSON.parse(raw) as { checklist_da_hoi?: unknown }).checklist_da_hoi;
    return Array.isArray(c) ? c.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

/** Leading answers (newest first) with ky_thuat = day_bu_nen. */
export function bridgeTurnsOf(rawsNewestFirst: readonly string[]): number {
  let n = 0;
  for (const raw of rawsNewestFirst) {
    try {
      if ((JSON.parse(raw) as { ky_thuat?: unknown }).ky_thuat !== "day_bu_nen") break;
    } catch {
      break;
    }
    n++;
  }
  return n;
}

/** A make_sibling result the tutor may use: machine-checked and with different numbers. */
export const usableSibling = (output: unknown): boolean => {
  const o = output as { verified?: unknown; numbers_differ?: unknown } | null;
  return o?.verified === true && o?.numbers_differ === true;
};

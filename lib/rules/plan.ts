// lib/rules/plan.ts — "Bài của em": the list of jobs the child ticks while solving (D38). Client-safe.
//
// The list lives in the tutor message that brought it (a block after the tutor's words), so the tutor reads it back
// in the history and parents see it in the review. Ticks are messages with role "system" (never in the model's
// history, never a pending turn): "plan:tick:2" / "plan:untick:2". The newest list wins; ticks count after it.

export const PLAN_HEAD = "📋 Bài của em — làm xong việc nào, em tick việc đó:";
export const MAX_STEPS = 7;
const STEP_LINE = /^☐ (\d)\. (.+)$/;

export function formatPlan(steps: readonly string[]): string {
  return [PLAN_HEAD, ...steps.map((s, i) => `☐ ${i + 1}. ${s}`)].join("\n");
}

/** The tutor's words and the list (null when the message has none). */
export function splitPlan(content: string): { text: string; steps: string[] | null } {
  const i = content.indexOf(PLAN_HEAD);
  if (i < 0) return { text: content, steps: null };
  const steps = content.slice(i + PLAN_HEAD.length).split("\n").map((l) => STEP_LINE.exec(l.trim())?.[2]).filter((s): s is string => !!s);
  return { text: content.slice(0, i).trimEnd(), steps: steps.length ? steps : null };
}

export interface PlanEvent { step: number; done: boolean }
export const planEventText = (e: PlanEvent) => `plan:${e.done ? "tick" : "untick"}:${e.step}`;
export function parsePlanEvent(content: string): PlanEvent | null {
  const m = /^plan:(tick|untick):(\d)$/.exec(content);
  return m ? { step: Number(m[2]), done: m[1] === "tick" } : null;
}

/** Ticked steps after applying the events in order (each event sets one step on or off). */
export function applyTicks(start: readonly number[], events: readonly PlanEvent[]): number[] {
  const on = new Set(start);
  for (const e of events) if (e.done) on.add(e.step); else on.delete(e.step);
  return [...on].sort((a, b) => a - b);
}

/** What the "Kẹt ở đây" button sends: the tutor helps with this job only (a normal model turn). */
export const stuckText = (n: number, step: string) => `Em kẹt ở việc ${n}: ${step}`;

/**
 * The ticks of the newest list, from a problem's messages and tick events in time order: a tutor message that
 * brings a list starts it empty; each event sets one job on or off.
 */
export function ticksForThread(items: readonly { role: "child" | "tutor" | "system"; content: string }[]): number[] {
  let ticks: number[] = [];
  for (const it of items) {
    if (it.role === "tutor" && splitPlan(it.content).steps) ticks = [];
    const e = it.role === "system" ? parsePlanEvent(it.content) : null;
    if (e) ticks = applyTicks(ticks, [e]);
  }
  return ticks;
}

/** The newest list of a thread (its message id and jobs), or null. */
export function currentPlan(thread: readonly { id: string; role: "child" | "tutor"; content: string; cardRef?: string | null }[]):
  { messageId: string; steps: string[]; cardRef: string | null } | null {
  for (let i = thread.length - 1; i >= 0; i--) {
    const m = thread[i]!;
    const steps = m.role === "tutor" ? splitPlan(m.content).steps : null;
    if (steps) return { messageId: m.id, steps, cardRef: m.cardRef ?? null };
  }
  return null;
}

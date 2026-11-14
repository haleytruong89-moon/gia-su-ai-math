// lib/entry.ts — pure: what the first screen shows for this visitor.
import type { Actor, resolveActor } from "@/lib/actor";

export type ChildActor = Extract<Actor, { role: "child" }>;
export type ParentActor = Extract<Actor, { role: "parent" }>;
export type NotReadyReason = "no_profile" | "no_teaching_profile" | "grade_not_supported";
export type Entry =
  | { kind: "signed_out" }
  | { kind: "parent"; actor: ParentActor }
  | { kind: "child"; actor: ChildActor }
  | { kind: "child_not_ready"; reason: NotReadyReason };

export function entryFrom(signedIn: boolean, r: ReturnType<typeof resolveActor>): Entry {
  if (!signedIn) return { kind: "signed_out" };
  if ("error" in r) return { kind: "child_not_ready", reason: r.error };
  return r.role === "parent" ? { kind: "parent", actor: r } : { kind: "child", actor: r };
}

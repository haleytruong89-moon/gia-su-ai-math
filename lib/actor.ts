// lib/actor.ts — pure, no I/O
export interface ProfileRow { id: string; family_id: string; role: "parent" | "child"; grade: number | null }
export interface TeachingRow { child_code: string; grade: number; max_lines: number; version: number; profile_text: string }
export type Actor =
  | { role: "child"; userId: string; familyId: string; grade: 6 | 9; childCode: string; maxLines: number; profileVersion: number; profileText: string }
  | { role: "parent"; userId: string; familyId: string };

export function resolveActor(profile: ProfileRow | null, teaching: TeachingRow | null):
  Actor | { error: "no_profile" | "no_teaching_profile" | "grade_not_supported" } {
  if (!profile) return { error: "no_profile" };
  if (profile.role === "parent") return { role: "parent", userId: profile.id, familyId: profile.family_id };
  if (profile.grade !== 6 && profile.grade !== 9) return { error: "grade_not_supported" };
  if (!teaching) return { error: "no_teaching_profile" };
  return {
    role: "child", userId: profile.id, familyId: profile.family_id, grade: profile.grade,
    childCode: teaching.child_code, maxLines: teaching.max_lines,
    profileVersion: teaching.version, profileText: teaching.profile_text,
  };
}

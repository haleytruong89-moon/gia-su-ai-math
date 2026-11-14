import "server-only";
// lib/parent/profiles.ts — teaching profiles for the parent page (service role, family-checked).
import { createAdminClient } from "@/lib/supabase/admin";
import type { ParentActor } from "@/lib/entry";
import { parseProfileForm, type AnswerMode } from "@/lib/profileForm";

export interface ChildCard {
  childId: string;
  name: string;
  grade: number | null;
  current: { childCode: string; maxLines: number; answerMode: AnswerMode; profileText: string; version: number; updatedAt: string } | null;
  lastVersion: number;
}

/** The family's children with their current teaching profile (the page is for parents only). */
export async function familyChildren(parent: ParentActor): Promise<ChildCard[]> {
  const admin = createAdminClient();
  const { data: kids, error } = await admin.from("profiles").select("id, display_name, grade")
    .eq("family_id", parent.familyId).eq("role", "child").order("created_at", { ascending: true });
  if (error) throw new Error(`familyChildren: ${error.message}`);
  const ids = (kids ?? []).map((k) => k.id as string);
  const { data: rows, error: e2 } = ids.length
    ? await admin.schema("tutor").from("teaching_profiles")
        .select("child_id, child_code, max_lines, answer_mode, profile_text, version, is_current, updated_at")
        .in("child_id", ids).is("deleted_at", null)
    : { data: [], error: null };
  if (e2) throw new Error(`familyChildren.profiles: ${e2.message}`);
  return (kids ?? []).map((k) => {
    const mine = (rows ?? []).filter((r) => r.child_id === k.id);
    const cur = mine.find((r) => r.is_current);
    return {
      childId: k.id as string,
      name: k.display_name as string,
      grade: (k.grade as number | null) ?? null,
      current: cur ? { childCode: cur.child_code, maxLines: cur.max_lines, answerMode: cur.answer_mode, profileText: cur.profile_text,
        version: cur.version, updatedAt: cur.updated_at } : null,
      lastVersion: Math.max(0, ...mine.map((r) => r.version as number)),
    };
  });
}

/**
 * Saves a new version (DOMAIN: every change = a new version) or pauses the tutor for one child
 * (no current profile → the child sees "Bố mẹ chưa bật cô gia sư"). Returns a Vietnamese error or null.
 */
export async function saveProfile(parent: ParentActor, raw: unknown): Promise<string | null> {
  const body = (raw ?? {}) as { action?: unknown; childId?: unknown };
  const admin = createAdminClient();
  if (typeof body.childId !== "string") return "Thiếu thông tin.";
  const { data: kid, error } = await admin.from("profiles").select("id, grade")
    .eq("id", body.childId).eq("family_id", parent.familyId).eq("role", "child").maybeSingle();
  if (error) throw new Error(`saveProfile.kid: ${error.message}`);
  if (!kid) return "Không tìm thấy con trong gia đình.";
  const t = admin.schema("tutor").from("teaching_profiles");
  const now = new Date().toISOString();

  if (body.action === "pause") {
    const { error: e } = await t.update({ is_current: false, updated_at: now }).eq("child_id", kid.id).eq("is_current", true);
    if (e) throw new Error(`saveProfile.pause: ${e.message}`);
    return null;
  }

  const parsed = parseProfileForm(raw, kid.grade as number);
  if (!parsed.ok) return parsed.error;
  const v = parsed.value;
  const { data: versions, error: e1 } = await t.select("version").eq("child_id", kid.id).order("version", { ascending: false }).limit(1);
  if (e1) throw new Error(`saveProfile.version: ${e1.message}`);
  const version = ((versions?.[0]?.version as number | undefined) ?? 0) + 1;
  // One current profile per child (unique index): retire the old one, then insert the new one.
  const { error: e2 } = await t.update({ is_current: false, updated_at: now }).eq("child_id", kid.id).eq("is_current", true);
  if (e2) throw new Error(`saveProfile.retire: ${e2.message}`);
  const { error: e3 } = await t.insert({
    family_id: parent.familyId, child_id: kid.id, child_code: v.childCode, grade: kid.grade, max_lines: v.maxLines,
    answer_mode: v.answerMode, profile_text: v.profileText, version, is_current: true, created_by: parent.userId,
  });
  if (e3?.code === "23505") return "Có người vừa lưu cùng lúc. Tải lại trang rồi thử lại.";
  if (e3) throw new Error(`saveProfile.insert: ${e3.message}`);
  return null;
}

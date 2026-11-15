import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveActor, type Actor, type ProfileRow, type TeachingRow } from "@/lib/actor";
import { entryFrom, type Entry } from "@/lib/entry";
export type { Actor } from "@/lib/actor";

/**
 * Who is visiting, from the Study Launcher session cookie (same address, D20). The user id comes
 * from Supabase Auth only, never from the request body. Profiles are read with the service role
 * because the tutor app writes nothing on the child's behalf without these checks.
 */
export async function getEntry(): Promise<Entry> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;
  if (!user) return entryFrom(false, { error: "no_profile" });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, family_id, role, grade")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();
  const { data: teaching } =
    profile?.role === "child"
      ? await admin
          .schema("tutor")
          .from("teaching_profiles")
          .select("child_code, grade, max_lines, version, profile_text")
          .eq("child_id", user.id)
          .eq("is_current", true)
          .is("deleted_at", null)
          .maybeSingle<TeachingRow>()
      : { data: null };
  return entryFrom(true, resolveActor(profile ?? null, teaching ?? null));
}

/** The signed-in actor, or null (signed out, or a child who cannot start yet). */
export async function getActor(): Promise<Actor | null> {
  const e = await getEntry();
  return e.kind === "child" || e.kind === "parent" ? e.actor : null;
}

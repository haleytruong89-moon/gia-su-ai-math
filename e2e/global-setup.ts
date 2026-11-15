import { adminClient, e2eEnv } from "./env";

/**
 * A fake family the way the Launcher stores it: 1 parent, 1 child in grade 9 ("Con thử"), and a
 * current teaching profile HS-9A with three made-up lines. Safe to run twice.
 */
export default async function globalSetup() {
  const env = e2eEnv();
  const admin = adminClient();
  const ids: Record<"parent" | "child", string> = { parent: "", child: "" };
  for (const who of ["parent", "child"] as const) {
    const { email, password } = env[who];
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error && !/already/i.test(error.message)) throw error;
    if (data.user) ids[who] = data.user.id;
    else {
      const { data: list, error: e2 } = await admin.auth.admin.listUsers();
      if (e2) throw e2;
      ids[who] = list.users.find((u) => u.email === email)!.id;
    }
  }
  const { data: existing } = await admin.from("profiles").select("family_id").eq("id", ids.parent).maybeSingle();
  let familyId = existing?.family_id as string | undefined;
  if (!familyId) {
    const { data: fam, error } = await admin.from("families").insert({ name: "Gia đình thử" }).select("id").single();
    if (error) throw error;
    familyId = fam.id as string;
    const { error: e2 } = await admin.from("profiles").insert([
      { id: ids.parent, family_id: familyId, role: "parent", display_name: "Bố mẹ thử" },
      { id: ids.child, family_id: familyId, role: "child", display_name: "Con thử", grade: 9 },
    ]);
    if (e2) throw e2;
  }
  const tutor = admin.schema("tutor");
  const { data: current } = await tutor.from("teaching_profiles").select("id").eq("child_id", ids.child).eq("is_current", true).maybeSingle();
  if (!current) {
    const { error } = await tutor.from("teaching_profiles").insert({
      family_id: familyId, child_id: ids.child, child_code: "HS-9A", grade: 9, max_lines: 6, answer_mode: "mixed", version: 1,
      profile_text: "mã: HS-9A\nlớp 9, sách Kết nối tri thức\nhồ sơ thử cho e2e", created_by: ids.parent,
    });
    if (error) throw error;
  }
}

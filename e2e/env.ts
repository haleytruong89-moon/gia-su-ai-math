import { createClient } from "@supabase/supabase-js";

/** Values from the local Supabase stack started by CI (`supabase status -o env`). Fake people only. */
export function e2eEnv() {
  const need = (name: string) => {
    const v = process.env[name];
    if (!v) throw new Error(`e2e: missing env ${name}`);
    return v;
  };
  return {
    supabaseUrl: need("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: need("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceKey: need("SUPABASE_SERVICE_ROLE_KEY"),
    parent: { email: "parent-e2e@example.com", password: "Parent-e2e-Passw0rd!" },
    child: { email: "child-e2e@example.com", password: "Child-e2e-Passw0rd!" },
  };
}

export function adminClient() {
  const env = e2eEnv();
  return createClient(env.supabaseUrl, env.serviceKey, { auth: { persistSession: false } });
}

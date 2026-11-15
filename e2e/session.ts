import { createServerClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";
import { e2eEnv } from "./env";

/**
 * Signs in like the Study Launcher login does and puts the same session cookies in the browser
 * (both apps share one address in production, D20). The Launcher itself is not running here.
 */
export async function signIn(context: BrowserContext, who: "parent" | "child") {
  const env = e2eEnv();
  const jar = new Map<string, string>();
  const supabase = createServerClient(env.supabaseUrl, env.anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value } of list) jar.set(name, value);
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword(env[who]);
  if (error) throw error;
  if (jar.size === 0) throw new Error("e2e: no session cookie was set");
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })));
}

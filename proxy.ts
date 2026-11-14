import type { NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/session";

/**
 * Keeps the shared Supabase session cookie fresh on page loads. The Study Launcher's own proxy
 * skips /gia-su/* (it is this app), so the tutor refreshes it here. API routes read the user
 * through lib/supabase/server.ts, which can set cookies itself.
 */
export async function proxy(request: NextRequest) {
  return refreshSession(request);
}

// Paths are relative to the basePath (/gia-su).
export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|fonts/|favicon.ico).*)"],
};

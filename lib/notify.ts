// lib/notify.ts — asks the Launcher to push a money message to the parents (D23, G7c). Server only.
// Route: study-launcher POST /api/internal/tutor-notify (3 fixed messages, shared secret TUTOR_NOTIFY_SECRET).
export type MoneyKind = "economy" | "console_blocked" | "burn";

export function launcherNotify(env: { LAUNCHER_URL?: string; TUTOR_NOTIFY_SECRET?: string }, fetcher: typeof fetch = fetch) {
  return async (kind: MoneyKind, familyId: string, forecastUsd?: number): Promise<boolean> => {
    if (!env.LAUNCHER_URL || !env.TUTOR_NOTIFY_SECRET) return false; // not set up yet: nothing is sent
    try {
      const res = await fetcher(new URL("/api/internal/tutor-notify", env.LAUNCHER_URL), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TUTOR_NOTIFY_SECRET}` },
        body: JSON.stringify({ familyId, kind, ...(kind === "burn" ? { forecastUsd } : {}) }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) console.error("launcher notify refused", res.status);
      return res.ok;
    } catch (e) {
      console.error("launcher notify failed", e instanceof Error ? e.name : "unknown");
      return false;
    }
  };
}

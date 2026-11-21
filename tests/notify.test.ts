import { describe, expect, it } from "vitest";
import { launcherNotify } from "@/lib/notify";

const F = "11111111-1111-4111-8111-111111111111";
function fake(status: number) {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = (async (url: URL, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response("{}", { status });
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("launcherNotify (D23)", () => {
  it("not set up → false, no request", async () => {
    const { f, calls } = fake(200);
    expect(await launcherNotify({}, f)("economy", F)).toBe(false);
    expect(await launcherNotify({ LAUNCHER_URL: "https://launcher.example" }, f)("economy", F)).toBe(false);
    expect(calls).toEqual([]);
  });
  it("posts the kind with the secret; burn carries the forecast", async () => {
    const { f, calls } = fake(200);
    const n = launcherNotify({ LAUNCHER_URL: "https://launcher.example", TUTOR_NOTIFY_SECRET: "s" }, f);
    expect(await n("burn", F, 61.5)).toBe(true);
    expect(await n("economy", F, 99)).toBe(true);
    expect(calls[0]?.url).toBe("https://launcher.example/api/internal/tutor-notify");
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe("Bearer s");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ familyId: F, kind: "burn", forecastUsd: 61.5 });
    expect(JSON.parse(String(calls[1]?.init.body))).toEqual({ familyId: F, kind: "economy" });
  });
  it("refused or unreachable → false", async () => {
    expect(await launcherNotify({ LAUNCHER_URL: "https://l.example", TUTOR_NOTIFY_SECRET: "s" }, fake(401).f)("economy", F)).toBe(false);
    const broken = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    expect(await launcherNotify({ LAUNCHER_URL: "https://l.example", TUTOR_NOTIFY_SECRET: "s" }, broken)("economy", F)).toBe(false);
  });
});

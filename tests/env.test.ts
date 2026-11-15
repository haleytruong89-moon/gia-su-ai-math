// tests/env.test.ts
import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "srv", ANTHROPIC_API_KEY: "sk-ant-x", TUTOR_MODEL_MAIN: "claude-sonnet-5-5",
  TUTOR_MODEL_LIGHT: "claude-haiku-5-5", CAS_URL: "https://cas.internal", CAS_SECRET: "c",
  LAUNCHER_URL: "https://launcher.example", TUTOR_NOTIFY_SECRET: "n", CRON_SECRET: "k",
};

describe("server env", () => {
  it("accepts a complete env", () => {
    expect(parseServerEnv(base).TUTOR_MODEL_MAIN).toBe("claude-sonnet-5-5");
  });
  it("rejects a missing API key", () => {
    const { ANTHROPIC_API_KEY: _drop, ...rest } = base;
    expect(() => parseServerEnv(rest)).toThrow(/ANTHROPIC_API_KEY/);
  });
  it("G1 runs without the CAS / notify / cron secrets (needed from G4, G7)", () => {
    const { CAS_URL: _a, CAS_SECRET: _b, LAUNCHER_URL: _c, TUTOR_NOTIFY_SECRET: _d, CRON_SECRET: _e, ...g1 } = base;
    expect(parseServerEnv(g1).ANTHROPIC_API_KEY).toBe("sk-ant-x");
  });
  it("still checks an optional URL when it is set", () => {
    expect(() => parseServerEnv({ ...base, CAS_URL: "not a url" })).toThrow(/CAS_URL/);
  });
  it("strong model defaults to Opus 5.5; the fake model is off unless set", () => {
    const e = parseServerEnv(base);
    expect(e.TUTOR_MODEL_STRONG).toBe("claude-opus-5-5");
    expect(e.TUTOR_FAKE_MODEL).toBeUndefined();
  });
});

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
});

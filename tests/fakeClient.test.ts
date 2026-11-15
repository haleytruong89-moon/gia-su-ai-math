import { describe, expect, it } from "vitest";
import { fakeAllowed, fakeClient } from "@/lib/tutor/fakeClient";
import { parseTutorOutput } from "@/lib/tutor/schema";

describe("fake model (e2e only)", () => {
  it("never on Vercel", () => {
    expect(fakeAllowed({ TUTOR_FAKE_MODEL: "1" } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(fakeAllowed({ TUTOR_FAKE_MODEL: "1", VERCEL: "1" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(fakeAllowed({} as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
  it("tutor replies are valid TutorOutput; the checker always passes", async () => {
    const c = fakeClient();
    const t = await c.create({ model: "claude-sonnet-5-5", messages: [{ role: "user", content: "[EM]\nđề" }] });
    expect(parseTutorOutput(t.content[0]!.text!).ok).toBe(true);
    const t2 = await c.create({ model: "claude-sonnet-5-5", messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "c" }] });
    expect(parseTutorOutput(t2.content[0]!.text!).ok).toBe(true);
    const g = await c.create({ model: "claude-haiku-5-5", system: "Em là bộ kiểm tra", messages: [] });
    expect(JSON.parse(g.content[0]!.text!)).toEqual({ pass: true, ly_do: [] });
  });
});

// tests/turn.test.ts
import { describe, expect, it } from "vitest";
import { costUsd } from "@/lib/anthropic";
import { runTutorTurn } from "@/lib/tutor/turn";
import fewshot from "./fixtures/fewshot.json";

describe("cost", () => {
  it("Sonnet 5.5: 1M in + 1M out = 2 + 10 USD (giá tra 13/11/2026)", () => {
    expect(costUsd("claude-sonnet-5-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(12, 6);
  });
  it("cached tokens are billed at the cache-read price", () => {
    expect(costUsd("claude-sonnet-5-5", { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.1, 6);
  });
});

describe("runTutorTurn", () => {
  it("parses a valid JSON reply and reports tokens", async () => {
    const reply = JSON.stringify((fewshot as object[])[0]);
    const client = { create: async () => ({ content: [{ type: "text", text: reply }],
      usage: { input_tokens: 1200, output_tokens: 150, cache_read_input_tokens: 8000 } }) };
    const r = await runTutorTurn(client, { model: "claude-sonnet-5-5", system: [], messages: [] });
    expect(r.output?.de_da_xac_nhan).toBe(false);
    expect(r.tokens).toEqual({ in: 9200, cached: 8000, out: 150 });
  });
  it("returns output = null (and keeps raw) when the reply is not valid", async () => {
    const client = { create: async () => ({ content: [{ type: "text", text: "xin chào" }],
      usage: { input_tokens: 10, output_tokens: 3 } }) };
    const r = await runTutorTurn(client, { model: "claude-sonnet-5-5", system: [], messages: [] });
    expect([r.output, r.raw]).toEqual([null, "xin chào"]);
  });
  it("leaves room for thinking: 5.5 models think by default and thinking counts toward max_tokens (G0 run 2)", async () => {
    let req: Record<string, unknown> = {};
    const client = { create: async (r: object) => { req = r as Record<string, unknown>;
      return { content: [{ type: "text", text: JSON.stringify((fewshot as object[])[0]) }], usage: { input_tokens: 1, output_tokens: 1 } }; } };
    await runTutorTurn(client, { model: "claude-sonnet-5-5", system: [], messages: [] });
    expect(req.max_tokens).toBeGreaterThanOrEqual(8000);
    expect((req.output_config as { effort: string }).effort).toBe("medium");
  });
  it("reports a reply cut by max_tokens", async () => {
    const client = { create: async () => ({ content: [{ type: "text", text: "{\"message\":\"Em" }], stop_reason: "max_tokens",
      usage: { input_tokens: 1, output_tokens: 1 } }) };
    const r = await runTutorTurn(client, { model: "claude-sonnet-5-5", system: [], messages: [] });
    expect([r.output, r.stopReason]).toEqual([null, "max_tokens"]);
  });
});

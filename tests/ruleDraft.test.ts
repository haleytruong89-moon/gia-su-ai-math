import { describe, expect, it } from "vitest";
import { draftRule, ruleDraftJsonSchema } from "@/lib/tutor/ruleDraft";
import type { ModelClient } from "@/lib/tutor/turn";

const reply = (o: unknown): ModelClient => ({
  async create(req) {
    seen.push(req as never);
    return { content: [{ type: "text", text: JSON.stringify(o) }], usage: { input_tokens: 200, output_tokens: 30 } };
  },
});
let seen: { system: { text: string }[]; messages: { content: string }[]; output_config: unknown }[] = [];
const D = { model: "claude-sonnet-5-5", prompt: "Em là người viết LUẬT DẠY" };
const input = { tutorText: "Cô giảng rất dài…", childBefore: "k", thumb: "down" as const, note: "Cô giảng dài, con đọc không hết" };

describe("draftRule (P3)", () => {
  it("a note → one rule; the request carries the note, the turn and the schema", async () => {
    seen = [];
    const r = await draftRule(reply({ rule: "Trả lời ngắn, mỗi lượt một ý.", skip: false }), D, input);
    expect(r.text).toBe("Trả lời ngắn, mỗi lượt một ý.");
    expect(r.call).toMatchObject({ model: "claude-sonnet-5-5", tokens: { in: 200, out: 30 } });
    expect(seen[0]?.messages[0]?.content).toContain("Cô giảng dài, con đọc không hết");
    expect(seen[0]?.messages[0]?.content).toContain("Cô giảng rất dài…");
    expect(seen[0]?.output_config).toEqual({ effort: "low", format: { type: "json_schema", schema: ruleDraftJsonSchema } });
  });
  it("skip (e.g. the note asks to give answers) → no rule", async () =>
    expect((await draftRule(reply({ rule: "", skip: true }), D, input)).text).toBeNull());
  it("an over-long rule is cut at 300 characters", async () =>
    expect((await draftRule(reply({ rule: "x".repeat(400), skip: false }), D, input)).text).toHaveLength(300));
  it("unreadable output → no rule, the call is still recorded", async () => {
    const r = await draftRule({ async create() { return { content: [{ type: "text", text: "oops" }], usage: { input_tokens: 1, output_tokens: 1 } }; } }, D, input);
    expect(r.text).toBeNull();
    expect(r.call).not.toBeNull();
  });
  it("API error → no rule, never throws", async () => {
    const r = await draftRule({ async create() { throw new Error("529 overloaded"); } }, D, input);
    expect(r).toEqual({ text: null, call: null });
  });
  it("schema is API-safe (no limits, closed objects)", () => {
    expect(ruleDraftJsonSchema.additionalProperties).toBe(false);
    expect(JSON.stringify(ruleDraftJsonSchema)).not.toMatch(/maxLength|minLength|maxItems|minItems|minimum|maximum/);
  });
});

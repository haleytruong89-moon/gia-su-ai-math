import { describe, expect, it } from "vitest";
import { runGuard, type GuardInput } from "@/lib/tutor/guard";
import { safeLine } from "@/lib/copy";
import fewshot from "./fixtures/fewshot.json";
import type { TutorOutput } from "@/lib/tutor/schema";

const output = (fewshot as unknown as TutorOutput[])[1]!;
const input: GuardInput = { statement: "Đề…", hintLevel: 2, submitted: false, maxLines: 6, output, toolsCalled: [] };
function reply(text: string) {
  const c = {
    last: null as Record<string, unknown> | null,
    async create(req: object) {
      c.last = req as Record<string, unknown>;
      return { content: [{ type: "text", text }], usage: { input_tokens: 500, output_tokens: 20 } };
    },
  };
  return c;
}

describe("runGuard", () => {
  it("passes when Haiku passes, and costs something", async () => {
    const r = await runGuard(reply('{"pass":true,"ly_do":[]}'), "claude-haiku-5-5", "PROMPT", input);
    expect([r.pass, r.reasons]).toEqual([true, []]);
    expect(r.costUsd).toBeGreaterThan(0);
  });
  it("fails with Haiku's reasons", async () => {
    const r = await runGuard(reply('{"pass":false,"ly_do":["1: lộ đáp số"]}'), "claude-haiku-5-5", "PROMPT", input);
    expect([r.pass, r.reasons]).toEqual([false, ["1: lộ đáp số"]]);
  });
  it("too many lines fails without calling Haiku", async () => {
    let called = false;
    const long = { ...output, message: "1\n2\n3\n4\n5\n6\n7" };
    const r = await runGuard({ create: async () => { called = true; throw new Error("no"); } }, "h", "P", { ...input, output: long });
    expect([r.pass, r.reasons, called]).toEqual([false, ["2: dài 7 dòng > 6"], false]);
  });
  it("fail-closed: Haiku unreadable or down → not passed", async () => {
    expect((await runGuard(reply("xin chào"), "claude-haiku-5-5", "P", input)).reasons).toEqual(["guard_unreadable"]);
    const down = await runGuard({ create: async () => { throw Object.assign(new Error("x"), { status: 529 }); } }, "claude-haiku-5-5", "P", input);
    expect([down.pass, down.reasons]).toEqual([false, ["guard_unavailable"]]);
  });
  it("Haiku runs without thinking, low effort, JSON schema, with the prompt as system", async () => {
    const c = reply('{"pass":true,"ly_do":[]}');
    await runGuard(c, "claude-haiku-5-5", "PROMPT", input);
    expect(c.last).toMatchObject({ system: "PROMPT", thinking: { type: "disabled" }, output_config: { effort: "low" } });
  });
});

describe("safeLine (DOMAIN §5: blocked twice)", () => {
  it("every level ends with a question; H4–H5 offer to save", () => {
    for (const l of [0, 1, 2, 3, 4, 5] as const) expect(safeLine(l).message.trim().endsWith("?")).toBe(true);
    expect(safeLine(5).buttons).toEqual(["Để dành hỏi thầy"]);
    expect(safeLine(2).buttons).toEqual([]);
  });
});

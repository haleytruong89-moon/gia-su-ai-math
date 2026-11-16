import { describe, expect, it } from "vitest";
import { MAX_TOOL_ROUNDS, runToolLoop } from "@/lib/tutor/toolLoop";
import fewshot from "./fixtures/fewshot.json";

const final = JSON.stringify((fewshot as object[])[1]);
const usage = { input_tokens: 10, output_tokens: 5 };
const toolUse = (id: string, input: object, name = "math_check") => ({
  content: [{ type: "thinking", thinking: "…", signature: "sig" }, { type: "tool_use", id, name, input }],
  stop_reason: "tool_use", usage,
});
const text = (t: string) => ({ content: [{ type: "text", text: t }], stop_reason: "end_turn", usage });
function scripted(steps: object[]) {
  const reqs: Record<string, unknown>[] = [];
  let i = 0;
  return { reqs, create: async (r: object) => { reqs.push(JSON.parse(JSON.stringify(r))); return steps[Math.min(i++, steps.length - 1)] as never; } };
}
const base = { model: "claude-sonnet-5-5", system: [], messages: [{ role: "user" as const, content: "x" }], timeLeft: () => 200_000 };
const okRun = async () => ({ ok: true, output: { ok: true, result: { is_root: true } } });

describe("runToolLoop", () => {
  it("runs the tool, sends tool_result back (thinking kept), then returns the JSON answer", async () => {
    const c = scripted([toolUse("t1", { mode: "check_root", equation: "x-2=0", value: "2" }), text(final)]);
    const r = await runToolLoop(c, { ...base, run: okRun });
    expect(r.final.output).not.toBeNull();
    expect(r.calls).toHaveLength(2);
    expect(r.tools).toEqual([expect.objectContaining({ tool: "math_check", ok: true, round: 0, input: { mode: "check_root", equation: "x-2=0", value: "2" } })]);
    const msgs = c.reqs[1]!.messages as { role: string; content: { type: string; tool_use_id?: string; is_error?: boolean; content?: string }[] }[];
    expect(msgs.at(-2)!.role).toBe("assistant");
    expect(msgs.at(-2)!.content.map((b) => b.type)).toEqual(["thinking", "tool_use"]);
    expect(msgs.at(-1)!.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "t1", is_error: false });
    expect(JSON.parse(msgs.at(-1)!.content[0]!.content!)).toEqual({ ok: true, result: { is_root: true } });
    expect(c.reqs[0]!.tools).toBeDefined();
  });
  it(`at most ${MAX_TOOL_ROUNDS} tool rounds, then tool_choice none forces the answer`, async () => {
    const c = scripted([toolUse("a", {}), toolUse("b", {}), toolUse("c", {}), toolUse("d", {}), text(final)]);
    const r = await runToolLoop(c, { ...base, run: okRun });
    expect(r.tools).toHaveLength(3);
    expect(r.tools.map((t) => t.round)).toEqual([0, 1, 2]);
    expect(c.reqs.at(-1)!.tool_choice).toEqual({ type: "none" });
    const lastMsgs = c.reqs.at(-1)!.messages as { content: { type: string; is_error?: boolean }[] }[];
    expect(lastMsgs.at(-1)!.content[0]).toMatchObject({ type: "tool_result", is_error: true }); // the 4th ask is refused
    expect(r.calls).toHaveLength(5);
    expect(r.final.output).not.toBeNull();
  });
  it("too little time left → no tool round: the tool call is answered by a forced final", async () => {
    const c = scripted([toolUse("a", {}), text(final)]);
    const r = await runToolLoop(c, { ...base, timeLeft: () => 30_000, run: okRun });
    expect(r.tools).toHaveLength(0);
    expect(c.reqs.at(-1)!.tool_choice).toEqual({ type: "none" });
  });
  it("an unknown tool or a failing tool is an error result, the loop goes on", async () => {
    const c = scripted([toolUse("z", {}, "draw_figure"), text(final)]);
    const r = await runToolLoop(c, { ...base, run: async () => ({ ok: false, output: { error: "unknown_tool" } }) });
    const msgs = c.reqs[1]!.messages as { content: { is_error?: boolean }[] }[];
    expect(msgs.at(-1)!.content[0]!.is_error).toBe(true);
    expect(r.tools[0]).toMatchObject({ ok: false });
  });
  it("review can send the answer back once (DOMAIN §4.12 b)", async () => {
    const c = scripted([text(final), toolUse("m", { mode: "equivalent" }), text(final), text(final)]);
    let asked = 0;
    const r = await runToolLoop(c, { ...base, run: okRun,
      review: (_o, tools) => (tools.length === 0 ? (asked++, "Gọi math_check cho đáp số cuối trước khi kết luận.") : null) });
    expect(asked).toBe(1);
    expect(r.tools).toHaveLength(1);
    expect(r.calls).toHaveLength(3);
    expect(JSON.stringify(c.reqs[1]!.messages)).toContain("[APP] Gọi math_check");
  });
  it("review is asked at most once", async () => {
    const c = scripted([text(final), text(final), text(final)]);
    let asked = 0;
    const r = await runToolLoop(c, { ...base, run: okRun, review: () => (asked++, "lại") });
    expect([asked, r.calls.length]).toEqual([1, 2]);
  });
  it("a thrown model error propagates (the caller releases the claim)", async () => {
    const c = { create: async () => { throw new Error("529"); } };
    await expect(runToolLoop(c, { ...base, run: okRun })).rejects.toThrow("529");
  });
});

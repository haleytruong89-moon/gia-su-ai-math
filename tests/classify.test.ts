import { describe, expect, it } from "vitest";
import { classifyProblem, EMPTY } from "@/lib/tutor/classify";

const reply = (o: object) => ({ content: [{ type: "text", text: JSON.stringify(o) }], stop_reason: "end_turn", usage: { input_tokens: 400, output_tokens: 20 } });
function client(o: object | Error) {
  const reqs: Record<string, unknown>[] = [];
  return { reqs, create: async (r: object) => { reqs.push(r as never); if (o instanceof Error) throw o; return reply(o) as never; } };
}
const d = { model: "claude-haiku-5-5", prompt: "P" };

describe("classifyProblem", () => {
  it("rút gọn → T9.9; a stated HN10 item keeps its slot; the grade's index is sent", async () => {
    const c = client({ ku_code: "T9.9", exam_slot: "HN10-2c", geometry_proof: false });
    const r = await classifyProblem(c, d, { grade: 9, statement: "Bài II câu 3 …" });
    expect(r.output).toEqual({ ku_code: "T9.9", exam_slot: "HN10-2c", geometry_proof: false });
    expect(r.call?.costUsd).toBeGreaterThan(0);
    expect(JSON.stringify(c.reqs[0])).toContain("T9.20 · Định lí Viète");
  });
  it("9.18 hai đường cao, chứng minh → geometry_proof (Opus signal); a proof KU alone does not set it", async () => {
    expect((await classifyProblem(client({ ku_code: "T9.16", exam_slot: null, geometry_proof: true }), d, { grade: 9, statement: "chứng minh AE·AC = AF·AB" })).output.geometry_proof).toBe(true);
    expect((await classifyProblem(client({ ku_code: "T9.15", exam_slot: null, geometry_proof: false }), d, { grade: 9, statement: "tính diện tích" })).output.geometry_proof).toBe(false);
  });
  it("grade 6: no slot, no proof flag, a grade 9 code is dropped", async () => {
    const r = await classifyProblem(client({ ku_code: "T9.9", exam_slot: "HN10-2c", geometry_proof: true }), d, { grade: 6, statement: "x" });
    expect(r.output).toEqual(EMPTY);
    const ok = await classifyProblem(client({ ku_code: "T6.12", exam_slot: null, geometry_proof: false }), d, { grade: 6, statement: "x" });
    expect(ok.output.ku_code).toBe("T6.12");
  });
  it("unknown code or a made-up slot → null; unreadable or failed call → EMPTY, no throw", async () => {
    expect((await classifyProblem(client({ ku_code: "T9.77", exam_slot: "HN10-9z", geometry_proof: false }), d, { grade: 9, statement: "x" })).output).toEqual(EMPTY);
    expect((await classifyProblem(client({ nope: 1 }), d, { grade: 9, statement: "x" })).output).toEqual(EMPTY);
    expect(await classifyProblem(client(new Error("529")), d, { grade: 9, statement: "x" })).toEqual({ output: EMPTY, call: null });
  });
});

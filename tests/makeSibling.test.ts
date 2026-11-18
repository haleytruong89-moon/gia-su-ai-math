import { describe, expect, it } from "vitest";
import { makeSibling, numbersDiffer, numbersIn } from "@/lib/tools/makeSibling";
import type { CasClient } from "@/lib/tools/casClient";

const THO = "Hai người cùng làm 16 giờ xong; người I làm 3 giờ, người II làm 6 giờ được 25% công việc. Hỏi mỗi người làm riêng mất bao lâu?";
const good = {
  statement: "Hai vòi cùng chảy 12 giờ đầy bể; vòi I chảy 2 giờ, vòi II chảy 4 giờ được 25% bể. Hỏi mỗi vòi chảy riêng mất bao lâu?",
  solution_steps: ["Gọi x, y là số giờ…", "Lập hệ…", "Giải hệ…"], final_answer: "Vòi I 20 giờ, vòi II 30 giờ",
  check: { mode: "check_solution", equations: ["1/x+1/y=1/12", "2/x+4/y=1/4"], values: [{ name: "x", value: "20" }, { name: "y", value: "30" }] },
};
function scriptedJson(list: object[]) {
  let i = 0;
  const reqs: Record<string, unknown>[] = [];
  return { reqs, create: async (r: object) => {
    reqs.push(r as never);
    return { content: [{ type: "text", text: JSON.stringify(list[Math.min(i++, list.length - 1)]) }], usage: { input_tokens: 100, output_tokens: 50 } };
  } };
}
const casFrom = (modes: Record<string, (a: Record<string, unknown>) => Record<string, unknown>>): CasClient => ({
  check: async (m, a) => ({ ok: true, result: modes[m]!(a) }), health: async () => true,
});
const deps = (client: ReturnType<typeof scriptedJson>, cas: CasClient | null) => ({ client, model: "claude-sonnet-5-5", prompt: "P", cas });

describe("numbers in a statement", () => {
  it("reads integers, Vietnamese decimals, fractions and percents", () => {
    expect(numbersIn(THO)).toEqual(["16", "3", "6", "25%"]);
    expect(numbersIn("gấp 1,25 lần, còn 3/4 bể")).toEqual(["1,25", "3/4"]);
  });
  it("a sibling may share at most 1 number, never all of them", () => {
    expect(numbersDiffer(THO, good.statement)).toBe(true);
    expect(numbersDiffer(THO, "Hai người cùng làm 16 giờ xong; người I làm 3 giờ, người II làm 6 giờ được 50% công việc.")).toBe(false);
    expect(numbersDiffer("Tính 5 + 7", "Tính 5 + 9")).toBe(true);   // 1 shared, not all
    expect(numbersDiffer("Tìm ƯCLN của 24", "Tìm ƯCLN của 24 và 36")).toBe(false); // every number of the original reused
  });
});

describe("makeSibling", () => {
  it("verified when cas confirms the sibling's answer; a wrong one is retried once", async () => {
    const client = scriptedJson([{ ...good, check: { ...good.check, values: [{ name: "x", value: "21" }, { name: "y", value: "30" }] } }, good]);
    const cas = casFrom({ check_solution: (a) => ({ satisfies: (a.values as Record<string, string>).x === "20", failed: [] }) });
    const r = await makeSibling(deps(client, cas), { original_statement: THO, ku_code: "T9.3", difficulty: "same" });
    expect([r.output.verified, r.output.numbers_differ, r.calls.length]).toEqual([true, true, 2]);
    expect(r.output.statement).toBe(good.statement);
    expect(JSON.stringify(client.reqs[1])).toContain("chưa đúng"); // the retry says why
  });
  it("numbers reused from the original → retried; still reused → numbers_differ false", async () => {
    const copy = { ...good, statement: THO };
    const client = scriptedJson([copy, copy]);
    const cas = casFrom({ check_solution: () => ({ satisfies: true, failed: [] }) });
    const r = await makeSibling(deps(client, cas), { original_statement: THO, ku_code: null, difficulty: "easier" });
    expect([r.output.verified, r.output.numbers_differ, r.calls.length]).toEqual([true, false, 2]);
  });
  it("cas down → verified false (never shown as a checked sibling)", async () => {
    const client = scriptedJson([good, good]);
    const cas: CasClient = { check: async () => ({ ok: false, error: "timeout" }), health: async () => false };
    const r = await makeSibling(deps(client, cas), { original_statement: THO, ku_code: null, difficulty: "same" });
    expect([r.output.verified, r.calls.length]).toEqual([false, 2]);
  });
  it("an unreadable reply or a check mode that cannot verify → verified false", async () => {
    const client = scriptedJson([{ nope: 1 }, { ...good, check: { mode: "evaluate", expr_a: "1+1" } }]);
    const r = await makeSibling(deps(client, casFrom({})), { original_statement: THO, ku_code: null, difficulty: "same" });
    expect(r.output.verified).toBe(false);
  });
});

describe("make_sibling — G0 18/11 fixes", () => {
  it("values come as {name, value} pairs and reach cas as an object", async () => {
    let seen: Record<string, unknown> | null = null;
    const cas = casFrom({ check_solution: (a) => { seen = a; return { satisfies: true, failed: [] }; } });
    const r = await makeSibling(deps(scriptedJson([good]), cas), { original_statement: THO, ku_code: "T9.3", difficulty: "same" });
    expect(r.output.verified).toBe(true);
    expect(seen!.values).toEqual({ x: "20", y: "30" });
  });
  it("the API refusing the call → not verified, no throw (the turn goes on)", async () => {
    const client = { create: async () => { throw Object.assign(new Error("400 schema"), { status: 400 }); } };
    const r = await makeSibling({ client, model: "claude-sonnet-5-5", prompt: "P", cas: null }, { original_statement: THO, ku_code: null, difficulty: "same" });
    expect(r.output.verified).toBe(false);
    expect(r.calls).toEqual([]);
  });
});

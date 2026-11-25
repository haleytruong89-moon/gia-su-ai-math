import { describe, expect, it } from "vitest";
import { decideGuard, guardJsonSchema, guardVerdictJson, runGuard, type GuardInput, type GuardVerdict } from "@/lib/tutor/guard";
import { isSafeLine, SAFE_AGAIN, SAFE_CONFIRMED, SAFE_STOP, safeLine, safeLinesInARow } from "@/lib/copy";
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
    const r = await runGuard(reply(guardVerdictJson()), "claude-haiku-5-5", "PROMPT", input);
    expect([r.pass, r.reasons]).toEqual([true, []]);
    expect(r.costUsd).toBeGreaterThan(0);
  });
  it("fails when Haiku finds a rule broken; the reason carries the rule number and the quote", async () => {
    const r = await runGuard(reply(guardVerdictJson({ lo_dap_so: "x = 24" })), "claude-haiku-5-5", "PROMPT", input);
    expect([r.pass, r.reasons]).toEqual([false, ['1: lộ đáp số hoặc lời giải bài gốc — "x = 24"']]);
  });
  // G8-fix2 (D35): real use 24–25/11 — Haiku said "pass: false" with reasons that all read "không vi phạm".
  it("Haiku gives no verdict any more: an old-style reply is unreadable (fail-closed)", async () => {
    const r = await runGuard(reply('{"pass":true,"ly_do":[]}'), "claude-haiku-5-5", "PROMPT", input);
    expect([r.pass, r.reasons]).toEqual([false, ["guard_unreadable"]]);
  });
  it("the checker is told what the child just wrote and which card is shown", async () => {
    const c = reply(guardVerdictJson());
    await runGuard(c, "claude-haiku-5-5", "PROMPT", { ...input, childText: "em ra ƯCLN là 84", card: "D9.2" });
    const sent = JSON.stringify(c.last);
    expect(sent).toContain("mới nhất ở cuối):\\nem ra ƯCLN là 84");
    expect(sent).toContain("the_giang: D9.2");
    await runGuard(c, "claude-haiku-5-5", "PROMPT", input);
    expect(JSON.stringify(c.last)).toContain("the_giang: không");
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
    const c = reply(guardVerdictJson());
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
  it("sends the problem photo to the checker when it is given (statement not confirmed yet)", async () => {
    const c = reply(guardVerdictJson());
    await runGuard(c, "claude-haiku-5-5", "P", { ...input, statement: "(đề trong ảnh, chưa xác nhận)", images: [{ mediaType: "image/jpeg", data: "QUJD" }] });
    expect(JSON.stringify(c.last)).toContain('"type":"image"');
    await runGuard(c, "claude-haiku-5-5", "P", input);
    expect(JSON.stringify(c.last)).not.toContain('"type":"image"');
  });
});

describe("safe lines in a row (G8-fix 24/11: never the same line twice in a row)", () => {
  const t = (content: string) => ({ role: "assistant", content });
  const k = (content: string) => ({ role: "user", content });
  it("counts the tutor's latest safe lines, newest first, skipping the child's messages", () => {
    expect(safeLinesInARow([])).toBe(0);
    expect(safeLinesInARow([t("Cô đọc đề là…"), k("đúng"), t(safeLine(0).message), k("em vẽ rồi")])).toBe(1);
    expect(safeLinesInARow([t(safeLine(0).message), k("?"), t(SAFE_AGAIN), k("??")])).toBe(2);
    expect(safeLinesInARow([t(safeLine(0).message), k("?"), t("Em vẽ đúng 3 điểm rồi!"), k("??")])).toBe(0);
  });
  it("second and later lines differ from the level line and offer the teacher", () => {
    expect(safeLine(0, 1)).toEqual({ message: SAFE_AGAIN, buttons: ["Để dành hỏi thầy"] });
    expect(safeLine(0, 2)).toEqual({ message: SAFE_STOP, buttons: ["Để dành hỏi thầy"] });
    expect(safeLine(3, 5).message).toBe(SAFE_STOP);
    for (const l of [0, 1, 2, 3, 4, 5] as const) expect(safeLine(l, 1).message).not.toBe(safeLine(l).message);
    expect([SAFE_AGAIN, SAFE_STOP].every((m) => m.trim().endsWith("?"))).toBe(true);
  });
  it("G8-fix2: once the statement is confirmed, H0–H1 ask where the child is instead of 'read the problem again'", () => {
    expect([safeLine(0, 0, true).message, safeLine(1, 0, true).message]).toEqual([SAFE_CONFIRMED, SAFE_CONFIRMED]);
    expect(SAFE_CONFIRMED).not.toContain("đọc lại đề");
    expect(safeLine(2, 0, true).message).toBe(safeLine(2).message);
    expect([safeLine(0, 1, true).message, safeLine(0, 2, true).message]).toEqual([SAFE_AGAIN, SAFE_STOP]);
    expect([isSafeLine(SAFE_CONFIRMED), safeLinesInARow([{ role: "assistant", content: SAFE_CONFIRMED }])]).toEqual([true, 1]);
  });
  it("recognises its own lines only", () => {
    expect([isSafeLine(` ${safeLine(1).message} `), isSafeLine(SAFE_STOP), isSafeLine("Mình đọc lại đề nhé")]).toEqual([true, true, false]);
  });
});

describe("decideGuard — the server decides, not Haiku (G8-fix2, D35)", () => {
  const v = (x: Parameters<typeof guardVerdictJson>[0]) => JSON.parse(guardVerdictJson(x)) as GuardVerdict;
  it("nothing found → pass", () => expect(decideGuard(v({}))).toEqual([]));
  it("each rule keeps its DOMAIN number", () => {
    expect(decideGuard(v({ lo_dap_so: "60", trach_moc: "sao em chậm thế", khang_dinh_chua_kiem: "Em tính đúng rồi", bai_anh_em_chua_kiem: "Bài anh em: …" }))
      .map((r) => r.split(":")[0])).toEqual(["1", "4", "6", "7"]);
  });
  it("a leak counts even without a quote; the other rules need the quoted sentence", () => {
    expect(decideGuard(v({ lo_dap_so: "" }))).toEqual(["1: lộ đáp số hoặc lời giải bài gốc"]);
    expect(decideGuard(v({ trach_moc: " ", khang_dinh_chua_kiem: "", bai_anh_em_chua_kiem: "" }))).toEqual([]);
  });
  it("an approved card is not a sibling problem — but a leak next to a card still blocks", () => {
    expect(decideGuard(v({ bai_anh_em_chua_kiem: "Cô giảng bằng một bài khác" }), { card: "D9.2" })).toEqual([]);
    expect(decideGuard(v({ bai_anh_em_chua_kiem: "Cô giảng bằng một bài khác" }))).toHaveLength(1);
    expect(decideGuard(v({ lo_dap_so: "x = 24" }), { card: "T6.12" })).toHaveLength(1);
  });
  it("the schema asks for the quote before the yes/no, for exactly the four rules", () => {
    expect(Object.keys(guardJsonSchema.properties)).toEqual(["lo_dap_so", "trach_moc", "khang_dinh_chua_kiem", "bai_anh_em_chua_kiem"]);
    expect(Object.keys(guardJsonSchema.properties.lo_dap_so.properties)).toEqual(["trich", "vi_pham"]);
  });
});

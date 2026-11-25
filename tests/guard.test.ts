import { describe, expect, it } from "vitest";
import { answerInButtons, decideGuard, guardJsonSchema, guardVerdictJson, runGuard, type GuardInput, type GuardVerdict } from "@/lib/tutor/guard";
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
  const v = (x: Parameters<typeof guardVerdictJson>[0], about?: Parameters<typeof guardVerdictJson>[1]) => JSON.parse(guardVerdictJson(x, about)) as GuardVerdict;
  const OK_CHECK = ["math_check(equivalent → equivalent=true)"];
  const ERR_CHECK = ["math_check(evaluate → error: cas_not_configured)"];
  it("nothing found → pass", () => expect(decideGuard(v({}))).toEqual([]));
  it("each rule keeps its DOMAIN number", () => {
    expect(decideGuard(v({ lo_dap_so: "60", trach_moc: "sao em chậm thế", khang_dinh_dung_sai: "Em tính đúng rồi", giai_bai_anh_em: "Bài anh em: …" }))
      .map((r) => r.split(":")[0])).toEqual(["1", "4", "6", "7"]);
  });
  it("a leak counts even without a quote; the other rules need the quoted sentence", () => {
    expect(decideGuard(v({ lo_dap_so: "" }))).toEqual(["1: lộ đáp số hoặc lời giải bài gốc"]);
    expect(decideGuard(v({ trach_moc: " ", khang_dinh_dung_sai: "", giai_bai_anh_em: "" }))).toEqual([]);
  });
  it("rule 6: only a claim about a calculation or an answer, and only when math_check did not run successfully", () => {
    const said = { khang_dinh_dung_sai: "Đúng rồi, ƯCLN = 84" };
    expect(decideGuard(v(said), { toolsCalled: [] })).toHaveLength(1);
    expect(decideGuard(v(said), { toolsCalled: ERR_CHECK })).toHaveLength(1);
    expect(decideGuard(v(said), { toolsCalled: OK_CHECK })).toEqual([]);
    expect(decideGuard(v(said), { toolsCalled: ["lookup(T6.11 → ok)"] })).toHaveLength(1);
    for (const about of ["chep_de", "chon_huong_hoac_cach_lam", "hinh_ve_hoac_chung_minh", "khac"] as const)
      expect(decideGuard(v({ khang_dinh_dung_sai: "Em chép đề đúng rồi" }, about), { toolsCalled: [] }), about).toEqual([]);
  });
  it("rule 7: not for an approved card, not when make_sibling verified the sibling", () => {
    const sib = { giai_bai_anh_em: "Cô giảng bằng một bài khác" };
    expect(decideGuard(v(sib))).toHaveLength(1);
    expect(decideGuard(v(sib), { card: "D9.2" })).toEqual([]);
    expect(decideGuard(v(sib), { toolsCalled: ["make_sibling(verified=true, numbers_differ=true)"] })).toEqual([]);
    expect(decideGuard(v(sib), { toolsCalled: ["make_sibling(verified=false, numbers_differ=true)"] })).toHaveLength(1);
  });
  it("a leak blocks whatever the tools and the card", () => {
    expect(decideGuard(v({ lo_dap_so: "x = 24" }), { card: "T6.12", toolsCalled: OK_CHECK })).toHaveLength(1);
  });
  it("the schema: scratch work and the answers of the problem first, then for each rule the quote before the yes/no", () => {
    expect(Object.keys(guardJsonSchema.properties)).toEqual(["tinh_nhap", "dap_so_bai_goc", "lo_dap_so", "trach_moc", "khang_dinh_dung_sai", "giai_bai_anh_em"]);
    expect(Object.keys(guardJsonSchema.properties.lo_dap_so.properties)).toEqual(["trich", "vi_pham"]);
    expect(Object.keys(guardJsonSchema.properties.khang_dinh_dung_sai.properties)).toEqual(["trich", "noi_ve", "vi_pham"]);
  });
});

describe("answerInButtons — the answer of the problem must not sit in a button (rules.md 1; G8-fix2)", () => {
  const FLOWERS = "Số bông từ 200 đến 300; bó 3, 5 hay 7 bông đều vừa hết. Hỏi có bao nhiêu bông?";
  it("a button with an answer Haiku listed → that button", () => {
    expect(answerInButtons({ answers: ["210"], statement: FLOWERS, buttons: ["105", "210", "315"] })).toBe("210");
    expect(answerInButtons({ answers: ["x = 24", "y = 48"], statement: "…16 giờ… 25%…", buttons: ["30 giờ", "24 giờ"] })).toBe("24 giờ");
    expect(answerInButtons({ answers: ["x = 2,5"], statement: "…", buttons: ["2", "2,5", "5"] })).toBe("2,5");
  });
  it("numbers of the statement and numbers the child wrote are not the tutor's leak", () => {
    expect(answerInButtons({ answers: ["210"], statement: FLOWERS, buttons: ["200", "300", "3"] })).toBeNull();
    expect(answerInButtons({ answers: ["ƯCLN = 84"], statement: "Tìm ƯCLN của 84 và 252", buttons: ["84", "252"] })).toBeNull();
    expect(answerInButtons({ answers: ["42"], statement: "…", childText: "- em ra 42", buttons: ["42", "Em chưa chắc"] })).toBeNull();
  });
  it("no answer, a proof, or a long list of numbers (a set of divisors) → no backstop: Haiku's own answer stands", () => {
    expect(answerInButtons({ answers: [], statement: FLOWERS, buttons: ["210"] })).toBeNull();
    expect(answerInButtons({ answers: ["ƯCLN = 12", "ƯC = {1; 2; 3; 4; 6; 12}"], statement: "Tìm ƯC của 24 và 36", buttons: ["6", "12"] })).toBeNull();
  });
  it("runGuard: Haiku found nothing but the answer is in a button → blocked; not after the child submitted", async () => {
    const out = { ...output, message: "Em chọn số đúng nhé?", buttons: ["105", "210", "315"] };
    const said = guardVerdictJson({}, "khac", ["210"]);
    const r = await runGuard(reply(said), "claude-haiku-5-5", "P", { ...input, statement: FLOWERS, output: out });
    expect([r.pass, r.reasons]).toEqual([false, ['1: lộ đáp số hoặc lời giải bài gốc — nút "210"']]);
    expect((await runGuard(reply(said), "claude-haiku-5-5", "P", { ...input, statement: FLOWERS, output: out, submitted: true })).pass).toBe(true);
  });
});

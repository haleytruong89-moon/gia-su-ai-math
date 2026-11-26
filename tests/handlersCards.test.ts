// G6a: the server shows approved cards (DOMAIN §4.15) and answers two buttons without the model (Y3).
import { splitPlan, stuckText } from "@/lib/rules/plan";
import { card } from "@/lib/knowledge/cards";
import { guardVerdictJson } from "@/lib/tutor/guard";
import { describe, expect, it } from "vitest";
import { handleTurn, tickPlan, type Deps } from "@/lib/tutor/handlers";
import type { ModelClient } from "@/lib/tutor/turn";
import { BTN_CARD_AGAIN, BTN_NOT_UNDERSTAND_PROBLEM, CARD_AGAIN_INTRO, CARD_BUTTONS, CARD_FALLBACK_INTRO, CARDS_DONE, DOC_DE_ASK, safeLine } from "@/lib/copy";
import { memoryRepo, type Seed } from "./helpers/memoryRepo";
import fewshot from "./fixtures/fewshot.json";

const grade6 = { role: "child" as const, userId: "c1", familyId: "f1", grade: 6 as const, childCode: "HS-6A",
  maxLines: 6, profileVersion: 1, profileText: "HỒ SƠ HS-6A" };
const NOW = new Date("2026-11-21T10:05:00Z");
const PASS = guardVerdictJson();
const base = { ...(fewshot as object[])[1] as Record<string, unknown>, danh_gia_luot_em: "khong_ap_dung" };
const out = (o: Record<string, unknown>) => JSON.stringify({ ...base, ...o });

function client(text: string) {
  let calls = 0;
  const reqs: { messages: { role: string; content: unknown }[] }[] = [];
  return {
    get calls() { return calls; },
    reqs,
    async create(req: object) {
      if (typeof (req as { system?: unknown }).system === "string") return { content: [{ type: "text", text: PASS }], usage: { input_tokens: 10, output_tokens: 10 } };
      calls++;
      reqs.push(req as never);
      return { content: [{ type: "text", text }], usage: { input_tokens: 10, output_tokens: 10 } };
    },
  };
}
const MODELS = { main: "claude-sonnet-5-5", strong: "claude-opus-5-5", light: "claude-haiku-5-5" };
function deps(seed: Seed, text = out({})) {
  const repo = memoryRepo(seed);
  const c = client(text);
  const d: Deps = { repo, client: c as unknown as ModelClient, actor: grade6, now: NOW, cas: null, promptVersion: "v0.7", models: MODELS,
    layers: { role: "①", rules: "②", method: "③", guard: "kiểm tra", sibling: "anh em", classify: "phân loại" } };
  return { d, repo, c };
}
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SHIPS = "Ba tàu cập bến 10 ngày, 15 ngày, 25 ngày một lần. Hỏi sau ít nhất bao nhiêu ngày cả ba cùng cập bến?";
const seed = (statement: string, extra: Seed["messages"] = []): Seed => ({
  problems: [{ id: "p1", childId: "c1", sessionId: "s1", turnCount: 2, statementConfirmed: true, confirmedStatement: statement, kuCode: "T6.12" }],
  messages: [{ problemId: "p1", role: "child", text: statement }, { problemId: "p1", role: "tutor", text: "Cô đọc đề là…" }, ...extra],
});
const turn = (n: number, text: string, kind: "text" | "button" = "text") => ({ problemId: "p1", clientMsgId: uuid(n), text, kind });
type Reply = { message: string; buttons: string[]; cardRef: string | null; turnCount: number };

// G8-fix2 (D35): in real use (24/11) the one card the tutor chose (D9.2) never reached the child — the checker
// called the card "a sibling problem without make_sibling" and wanted the card message to end with a question.
describe("G8-fix2: an approved card passes the checker", () => {
  function scripted(text: string, guard: string) {
    const guardReqs: object[] = [];
    return { guardReqs, async create(req: object) {
      const isGuard = typeof (req as { system?: unknown }).system === "string";
      if (isGuard) guardReqs.push(req);
      return { content: [{ type: "text", text: isGuard ? guard : text }], usage: { input_tokens: 10, output_tokens: 10 } };
    } };
  }
  const card = out({ the_hien: "T6.12", message: "Cô giảng phần này bằng một ví dụ khác nhé, em đọc kỹ rồi chép phần Ghi vào vở:", buttons: [] });
  it("the checker says 'sibling' about the card's lead-in → the card is shown all the same", async () => {
    const c = scripted(card, guardVerdictJson({ giai_bai_anh_em: "Cô giảng phần này bằng một ví dụ khác nhé" }));
    const { d, repo } = deps(seed(SHIPS));
    const r = await handleTurn({ ...d, client: c as unknown as ModelClient }, turn(1, "BCNN là gì ạ"));
    expect(r.json).toMatchObject({ cardRef: "T6.12#1" });
    expect(repo.modelCalls.filter((m) => m.purpose === "tutor").map((m) => m.guardResult)).toEqual(["pass"]);
    expect(JSON.stringify(c.guardReqs[0])).toContain("the_giang: T6.12");
  });
  it("a leak in the card's lead-in still blocks", async () => {
    const c = scripted(card, guardVerdictJson({ lo_dap_so: "150" }));
    const { d, repo } = deps(seed(SHIPS));
    const r = await handleTurn({ ...d, client: c as unknown as ModelClient }, turn(1, "BCNN là gì ạ"));
    expect(repo.modelCalls.filter((m) => m.purpose === "tutor").every((m) => m.guardResult === "blocked")).toBe(true);
    // the tutor's lead-in never reaches the child; the server shows the lesson's card with its own lead-in (D36)
    expect(r.json).toMatchObject({ message: CARD_FALLBACK_INTRO, cardRef: expect.stringMatching(/^T6\.12#/) });
  });
  it("a card of the other grade is not an approved card for this child: 'sibling' blocks", async () => {
    const c = scripted(out({ the_hien: "D9.2", message: "Cô giảng cách vẽ hình bằng một bài khác nhé:", buttons: [] }),
      guardVerdictJson({ giai_bai_anh_em: "Cô giảng cách vẽ hình bằng một bài khác nhé" }));
    const { d, repo } = deps(seed(SHIPS));
    await handleTurn({ ...d, client: c as unknown as ModelClient }, turn(1, "vẽ hình thế nào ạ"));
    expect(repo.modelCalls.filter((m) => m.purpose === "tutor").every((m) => m.guardResult === "blocked")).toBe(true);
  });
});

// D36: when no answer gets through the checker, the lesson's approved card is shown instead of a safe line.
describe("D36: blocked twice → the lesson's card; a blocked 'chưa biết' still raises the level", () => {
  const blocked = guardVerdictJson({ lo_dap_so: "84" });
  function allBlocked() {
    return { async create(req: object) {
      const isGuard = typeof (req as { system?: unknown }).system === "string";
      return { content: [{ type: "text", text: isGuard ? blocked : out({ message: "…", buttons: [] }) }], usage: { input_tokens: 10, output_tokens: 10 } };
    } };
  }
  const UC = "Tìm ƯCLN của 84 và 252, rồi tìm các ước chung của 336 và 504.";
  const ucSeed = (extra: Seed["messages"] = []): Seed => ({
    problems: [{ id: "p1", childId: "c1", sessionId: "s1", turnCount: 2, statementConfirmed: true, confirmedStatement: UC, kuCode: "T6.11" }],
    messages: [{ problemId: "p1", role: "child", text: UC }, { problemId: "p1", role: "tutor", text: "Cô đọc đề là…" }, ...extra],
  });
  it("the card of the lesson (T6.11) with a short lead-in and the card buttons", async () => {
    const { d, repo } = deps(ucSeed());
    const r = (await handleTurn({ ...d, client: allBlocked() as unknown as ModelClient }, turn(1, "em làm ƯCLN rồi"))).json as Reply;
    expect(r.cardRef).toMatch(/^T6\.11#[12]$/);
    expect(r.message).toBe(CARD_FALLBACK_INTRO);
    expect(r.buttons).toEqual([...CARD_BUTTONS]);
    expect(repo.messages.at(-1)!.cardRef).toBe(r.cardRef);
  });
  it("the card was shown already in this problem → the safe line as before", async () => {
    const { d } = deps(ucSeed([{ problemId: "p1", role: "tutor", text: CARD_FALLBACK_INTRO, cardRef: "T6.11#1" }]));
    const r = (await handleTurn({ ...d, client: allBlocked() as unknown as ModelClient }, turn(1, "em làm ƯCLN rồi"))).json as Reply;
    expect(r.cardRef).toBeNull();
    expect(r.message).toBe(safeLine(0, 0, true).message);
  });
  it("a blocked turn where the child said 'chưa biết' raises the hint level; an attempt does not", async () => {
    const a = deps(ucSeed());
    await handleTurn({ ...a.d, client: allBlocked() as unknown as ModelClient }, turn(1, "Em chưa biết"));
    expect(a.repo.problems[0]!.hintLevel).toBe(1);
    const b = deps(ucSeed());
    await handleTurn({ ...b.d, client: allBlocked() as unknown as ModelClient }, turn(1, "em ra 84"));
    expect(b.repo.problems[0]!.hintLevel).toBe(0);
  });
});

describe("the tutor names a card, the server shows it (§4.15)", () => {
  it("way 1 when its example does not use the child's numbers; fixed buttons; H2 at least (Y1)", async () => {
    const { d, repo } = deps(seed(SHIPS), out({ the_hien: "T6.12", message: "Cô giảng em phần này nhé:", buttons: ["Ước chung"] }));
    const r = await handleTurn(d, turn(1, "BCNN là gì ạ"));
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ cardRef: "T6.12#1", buttons: ["Em hiểu rồi", "Giảng lại cách khác"], message: "Cô giảng em phần này nhé:" });
    expect(repo.problems[0]!.hintLevelMax).toBeGreaterThanOrEqual(2);
    expect(repo.messages.at(-1)!.cardRef).toBe("T6.12#1");
  });
  it("D37: a worked-example card (cách làm, C6.1) is shown the same way but is not a hint (H stays 0)", async () => {
    const { d, repo } = deps(seed("Tìm ƯCLN(84, 120)"), out({ the_hien: "C6.1", ky_thuat: "bai_mau", message: "Cô làm mẫu cách liệt kê ước trên số khác nhé:" }));
    const r = await handleTurn(d, turn(1, "Liệt kê ước"));
    expect(r.json).toMatchObject({ cardRef: "C6.1#1", buttons: ["Giảng lại cách khác"], planTicks: [] }); // D38: no "Em hiểu rồi"
    expect(repo.problems[0]!.hintLevelMax).toBe(0);
    // D38: the card's jobs come under the tutor's words as the list the child ticks.
    const { text, steps } = splitPlan((r.json as Reply).message);
    expect(text).toBe("Cô làm mẫu cách liệt kê ước trên số khác nhé:");
    expect(steps).toEqual(card("C6.1")!.steps);
  });
  it("D37: the state block tells the tutor whether the statement was typed and whether a worked example was shown", async () => {
    const a = deps(seed("Tìm ƯCLN(84, 120)"));
    await handleTurn(a.d, turn(1, "Liệt kê ước"));
    expect(JSON.stringify(a.c.reqs[0])).toContain("de_tu_anh: false | da_co_bai_mau: false | chung_minh_hinh: false");
    const b = deps(seed("Tìm ƯCLN(84, 120)", [{ problemId: "p1", role: "tutor", text: "Cô làm mẫu:", cardRef: "C6.1#1" }]));
    await handleTurn(b.d, turn(1, "Em làm ra 12"));
    expect(JSON.stringify(b.c.reqs[0])).toContain("da_co_bai_mau: true");
  });
  it("way 2 when way 1 uses the child's numbers (C1)", async () => {
    const { d } = deps(seed("Hai đèn nháy sau 12 giây và 18 giây. Sau bao lâu cùng nháy?"), out({ the_hien: "T6.12" }));
    expect(((await handleTurn(d, turn(1, "BCNN là gì ạ"))).json as Reply).cardRef).toBe("T6.12#2");
  });
  it("a card of the other grade or an unknown code is not shown; the tutor's words stay", async () => {
    for (const code of ["T9.9", "T6.99"]) {
      const { d } = deps(seed(SHIPS), out({ the_hien: code, message: "Lời cô", buttons: ["A"] }));
      expect((await handleTurn(d, turn(1, "là gì ạ"))).json).toMatchObject({ cardRef: null, message: "Lời cô", buttons: ["A"] });
    }
  });
  it("the next model turn reads the card text in the history (the tutor never sees the screen)", async () => {
    const { d, c } = deps(seed(SHIPS, [{ problemId: "p1", role: "child", text: "BCNN là gì ạ" },
      { problemId: "p1", role: "tutor", text: "Cô giảng nhé:", cardRef: "T6.12#1" }]));
    await handleTurn(d, turn(1, "Em hiểu rồi", "button"));
    expect(JSON.stringify(c.reqs[0]!.messages)).toContain("[THẺ ĐÃ HIỆN CHO EM: T6.12#1");
  });
});

describe("scripted buttons (Y3: no model call, no turn counted)", () => {
  const afterCard = seed(SHIPS, [{ problemId: "p1", role: "child", text: "BCNN là gì ạ" },
    { problemId: "p1", role: "tutor", text: "Cô giảng nhé:", cardRef: "T6.12#1" }]);
  it("'Giảng lại cách khác' → way 2, the model is not called, turnCount stays", async () => {
    const { d, repo, c } = deps(afterCard);
    const r = await handleTurn(d, turn(1, BTN_CARD_AGAIN, "button"));
    expect(r.json).toMatchObject({ message: CARD_AGAIN_INTRO, cardRef: "T6.12#2", turnCount: 2 });
    expect(c.calls).toBe(0);
    expect(repo.problems[0]!.turnCount).toBe(2);
    expect(repo.messages.at(-1)).toMatchObject({ role: "tutor", cardRef: "T6.12#2" });
  });
  it("after way 2 → the offer to save; a resend answers the same, once", async () => {
    const { d, repo, c } = deps(seed(SHIPS, [{ problemId: "p1", role: "tutor", text: "Cô giảng cách khác nhé:", cardRef: "T6.12#2" }]));
    const r = await handleTurn(d, turn(1, BTN_CARD_AGAIN, "button"));
    expect(r.json).toMatchObject({ message: CARDS_DONE, buttons: ["Để dành hỏi thầy", "Em thử lại"], cardRef: null });
    const again = await handleTurn(d, turn(1, BTN_CARD_AGAIN, "button"));
    expect(again.json).toEqual(r.json);
    expect(repo.messages.filter((m) => m.role === "tutor")).toHaveLength(3);
    expect(c.calls).toBe(0);
  });
  it("'Em không hiểu đề' → 3 diagnosis buttons for grade 6, no model call", async () => {
    const { d, c } = deps(seed(SHIPS));
    const r = await handleTurn(d, turn(1, BTN_NOT_UNDERSTAND_PROBLEM, "button"));
    expect(r.json).toMatchObject({ message: DOC_DE_ASK, cardRef: null });
    expect((r.json as Reply).buttons).toHaveLength(3);
    expect(c.calls).toBe(0);
  });
  it("the same words typed go to the tutor", async () => {
    const { d, c } = deps(seed(SHIPS));
    await handleTurn(d, turn(1, BTN_NOT_UNDERSTAND_PROBLEM, "text"));
    expect(c.calls).toBe(1);
  });
});

describe("the review queue (G6b, Y2, §4.11)", () => {
  const afterCard = seed(SHIPS, [{ problemId: "p1", role: "child", text: "BCNN là gì ạ" },
    { problemId: "p1", role: "tutor", text: "Cô giảng nhé:", cardRef: "T6.12#1" }]);
  it("'Em hiểu rồi' under a card → its questions, due tomorrow; the model still answers the turn", async () => {
    const { d, repo, c } = deps(afterCard);
    await handleTurn(d, turn(1, "Em hiểu rồi", "button"));
    expect(c.calls).toBe(1);
    expect(repo.reviewItems.length).toBeGreaterThan(0);
    expect(repo.reviewItems.every((r) => r.cardCode === "T6.12" && r.dueDateVn === "2026-11-22" && r.box === 1 && r.status === "active")).toBe(true);
  });
  it("pressed again later → no duplicates", async () => {
    const { d, repo } = deps(afterCard);
    await handleTurn(d, turn(1, "Em hiểu rồi", "button"));
    const n = repo.reviewItems.length;
    repo.messages.push({ ...repo.messages.at(-1)!, id: "mX", cardRef: "T6.12#2", text: "Cô giảng cách khác nhé:", role: "tutor" });
    await handleTurn(d, turn(2, "Em hiểu rồi", "button"));
    expect(repo.reviewItems.length).toBe(n);
  });
  it("a real mistake on the lesson reopens its retired question (box 1, tomorrow)", async () => {
    const s = seed(SHIPS);
    s.reviewItems = [{ id: "r1", kuCode: "T6.12", status: "retired", box: 4, correctStreak: 3, dueDateVn: "2026-11-01" }];
    const { d, repo } = deps(s, out({ danh_gia_luot_em: "sai", ku_code_de_xuat: "T6.12" }));
    await handleTurn(d, turn(1, "Em ra 30 ngày"));
    expect(repo.reviewItems[0]).toMatchObject({ status: "active", box: 1, correctStreak: 0, dueDateVn: "2026-11-22" });
  });
});

describe("D38: 'Bài của em' — a list of jobs the child ticks", () => {
  const UC2 = "Tìm ƯCLN(84, 120)";
  const JOBS = ["Phân tích 84 ra thừa số nguyên tố", "Phân tích 120 ra thừa số nguyên tố", "Lấy thừa số chung, mũ nhỏ nhất, nhân lại"];
  const tick = (n: number, step: number, done = true) => ({ problemId: "p1", clientMsgId: uuid(100 + n), step, done });
  const withPlan = () => {
    const a = deps(seed(UC2), out({ ky_thuat: "bai_mau", ke_hoach: JOBS, message: "Giờ em làm bài của em theo danh sách nhé.", buttons: ["Hiểu rồi"] }));
    return a;
  };

  it("the tutor's list (only the problem's numbers) comes under its words; no buttons, nothing ticked", async () => {
    const { d } = withPlan();
    const r = await handleTurn(d, turn(1, "Em hiểu rồi", "button"));
    const reply = r.json as Reply & { planTicks: number[] };
    expect(splitPlan(reply.message)).toEqual({ text: "Giờ em làm bài của em theo danh sách nhé.", steps: JOBS });
    expect(reply.buttons).toEqual([]);
    expect(reply.planTicks).toEqual([]);
  });
  it("a list with a result in it is not shown (the tutor's words and buttons stay)", async () => {
    const { d } = deps(seed(UC2), out({ ky_thuat: "bai_mau", ke_hoach: ["84 = 2² · 3 · 7", "Phân tích 120"], message: "Em làm nhé.", buttons: ["Hiểu rồi"] }));
    const reply = (await handleTurn(d, turn(1, "Em hiểu rồi", "button"))).json as Reply;
    expect(splitPlan(reply.message).steps).toBeNull();
    expect(reply.buttons).toEqual(["Hiểu rồi"]);
  });
  it("ticks: no model call, no turn; a double tap is stored once; untick works; the tutor reads the progress", async () => {
    const { d, repo, c } = withPlan();
    await handleTurn(d, turn(1, "Em hiểu rồi", "button"));
    const calls = c.calls;
    const turns = repo.problems[0]!.turnCount;
    expect((await tickPlan(d, tick(1, 1))).json).toEqual({ planTicks: [1], allDone: false });
    expect((await tickPlan(d, tick(1, 1))).json).toEqual({ planTicks: [1], allDone: false });
    expect((await tickPlan(d, tick(2, 2))).json).toEqual({ planTicks: [1, 2], allDone: false });
    expect((await tickPlan(d, tick(3, 1, false))).json).toEqual({ planTicks: [2], allDone: false });
    expect([c.calls, repo.problems[0]!.turnCount, repo.planEvents.length]).toEqual([calls, turns, 3]);
    // The next turn is not blocked by the ticks (they are not a pending child message) and sees the progress.
    const r = await handleTurn(d, turn(2, stuckText(3, JOBS[2]!), "button"));
    expect(r.status).toBe(200);
    expect(JSON.stringify(c.reqs.at(-1))).toContain("danh_sach_viec: em đã tick 1/3 việc (2)");
  });
  it("a job that does not exist, or no list → 409", async () => {
    const { d } = withPlan();
    expect((await tickPlan(d, tick(1, 1))).status).toBe(409);
    await handleTurn(d, turn(1, "Em hiểu rồi", "button"));
    expect((await tickPlan(d, tick(2, 4))).status).toBe(409);
  });
  it("after a wrong answer the tutor sends a job back: the server unticks it", async () => {
    const a = withPlan();
    await handleTurn(a.d, turn(1, "Em hiểu rồi", "button"));
    for (const [n, s] of [[1, 1], [2, 2], [3, 3]] as const) await tickPlan(a.d, tick(n, s));
    const d2 = { ...a.d, client: client(out({ viec_can_lam_lai: [2], danh_gia_luot_em: "sai", message: "Việc 2 em xem lại nhé." })) as unknown as ModelClient };
    const r = await handleTurn(d2, { ...turn(2, "ƯCLN = 6"), kind: "submit" as const });
    expect((r.json as { planTicks: number[] }).planTicks).toEqual([1, 3]);
    expect((await a.repo.getProblemForChild("p1", "c1"))!.planTicks).toEqual([1, 3]);
  });
  it("ticking the last job of a card's list queues the card's review questions (once)", async () => {
    const { d, repo } = deps(seed(UC2), out({ the_hien: "C6.1", ky_thuat: "bai_mau", message: "Cô làm mẫu:" }));
    await handleTurn(d, turn(1, "Liệt kê ước", "button"));
    const n = card("C6.1")!.steps!.length;
    for (let s = 1; s <= n; s++) await tickPlan(d, tick(s, s));
    expect(repo.reviewItems.filter((x) => x.cardCode === "C6.1").length).toBe(card("C6.1")!.review.length);
    await tickPlan(d, tick(20, n, false));
    await tickPlan(d, tick(21, n));
    expect(repo.reviewItems.filter((x) => x.cardCode === "C6.1").length).toBe(card("C6.1")!.review.length);
  });
});

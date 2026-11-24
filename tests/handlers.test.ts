import { describe, expect, it } from "vitest";
import { handleTurn, newProblem, saveForLater, startSession, STALE_PENDING_MS, type Deps } from "@/lib/tutor/handlers";
import { costUsd } from "@/lib/anthropic";
import type { ModelClient } from "@/lib/tutor/turn";
import sharp from "sharp";
import { beforeAll } from "vitest";
import { BTN_NOT_UNDERSTOOD, BTN_SAVE, PHOTO_COPY, PHOTO_ONLY_TEXT, SAFE_AGAIN, SAFE_BUSY, SAFE_STOP, safeLine } from "@/lib/copy";
import { TOO_BIG } from "@/lib/tutor/form";
import { memoryRepo, type Seed } from "./helpers/memoryRepo";
import fewshot from "./fixtures/fewshot.json";

const child = { role: "child" as const, userId: "c1", familyId: "f1", grade: 9 as const, childCode: "HS-9A",
  maxLines: 6, profileVersion: 1, profileText: "HỒ SƠ HS-9A" };
const NOW = new Date("2026-11-14T10:05:00Z");
const confirm = JSON.stringify((fewshot as object[])[0]); // Mẫu 1: xác nhận đề, de_da_xac_nhan = false
const confirmed = JSON.stringify((fewshot as object[])[1]); // de_da_xac_nhan = true

const PASS = JSON.stringify({ pass: true, ly_do: [] });
const isGuardReq = (req: object) => typeof (req as { system?: unknown }).system === "string"; // tutor system = blocks

/** Tutor replies in order; every checker call passes (the G1 tests do not test the checker). */
function client(texts: string[] | (() => never)) {
  let calls = 0;
  const reqs: { messages: { role: string; content: string }[] }[] = [];
  return {
    get calls() { return calls; },
    reqs,
    async create(req: object) {
      if (typeof texts === "function") texts();
      if (isGuardReq(req)) return { content: [{ type: "text", text: PASS }], usage: { input_tokens: 1000, output_tokens: 100 } };
      calls++;
      reqs.push(req as never);
      const text = (texts as string[])[Math.min(calls - 1, (texts as string[]).length - 1)] ?? "";
      return { content: [{ type: "text", text }], usage: { input_tokens: 1000, output_tokens: 100 } };
    },
  };
}

function deps<C extends ModelClient = ReturnType<typeof client>>(seed: Seed = {}, c: C = client([confirm]) as unknown as C,
  actor: Deps["actor"] = child) {
  const repo = memoryRepo(seed);
  const d: Deps = { repo, client: c, actor, now: NOW, layers: { role: "①", rules: "②", method: "③", guard: "Em là bộ kiểm tra", sibling: "Em là người soạn BÀI ANH EM", classify: "Em là bộ phân loại" },
    promptVersion: "v0.2", models: MODELS, cas: null };
  return { d, repo, c };
}
const MODELS = { main: "claude-sonnet-5-5", strong: "claude-opus-5-5", light: "claude-haiku-5-5" };
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const inProgress: Seed = { problems: [{ id: "p1", childId: "c1", sessionId: "s1" }] };

describe("startSession", () => {
  it("401 for a parent or a visitor", async () => {
    expect((await startSession(deps({}, client([confirm]), null).d, { device: "laptop" })).status).toBe(401);
    expect((await startSession(deps({}, client([confirm]), { role: "parent", userId: "p", familyId: "f1" }).d, {})).status).toBe(401);
  });
  it("reuses today's active session; date_vn is the Vietnam date (23:30 UTC 14/11 = 15/11)", async () => {
    const { d, repo } = deps({ sessions: [{ childId: "c1", dateVn: "2026-11-15" }] });
    const late = { ...d, now: new Date("2026-11-14T23:30:00Z") };
    const r = await startSession(late, { device: "ipad" });
    expect(r.json).toEqual({ sessionId: repo.sessions[0]?.id, reused: true });
  });
  it("an active session from an earlier day is abandoned, with its open problems, and a new one opens", async () => {
    const { d, repo } = deps({ sessions: [{ childId: "c1", dateVn: "2026-11-13" }] });
    repo.problems.push({ id: "old", childId: "c1", familyId: "f1", sessionId: repo.sessions[0]!.id, status: "in_progress",
      turnCount: 3, hintLevel: 0, hintLevelMax: 0, nanJumps: 0, wrongCount: 0, offtopicCount: 0, uLevel: 0, stuckKind: null,
      statementConfirmed: true, confirmedStatement: "đề cũ", kuCode: null, examSlot: null, prereqGaps: [], knowledgeVersion: null });
    const r = await startSession(d, { device: "laptop" });
    expect((r.json as { reused: boolean }).reused).toBe(false);
    expect(repo.sessions.map((s) => s.status)).toEqual(["abandoned", "active"]);
    expect(repo.problems[0]?.status).toBe("abandoned");
  });
});

describe("newProblem", () => {
  const body = { clientMsgId: uuid(1), stuckKind: "khong_biet_bat_dau", statement: "Hai người thợ cùng làm 16 giờ thì xong…", device: "laptop" };
  it("creates the problem and runs the first turn (tutor restates the problem)", async () => {
    const { d, repo, c } = deps();
    const r = await newProblem(d, body);
    expect(r.status).toBe(200);
    const json = r.json as { problemId: string; reply: { message: string; turnCount: number; status: string } };
    expect(json.reply.message).toMatch(/Em kiểm tra giúp cô đúng chưa\?/);
    expect(json.reply.turnCount).toBe(1);
    expect(repo.problems[0]?.stuckKind).toBe("khong_biet_bat_dau");
    expect(c.reqs[0]?.messages.at(-1)?.content).toContain("cho_ket_cua_em: khong_biet_bat_dau");
    expect(c.reqs[0]?.messages.at(-1)?.content).toContain("Hai người thợ");
  });
  it("a double tap with the same clientMsgId opens one problem only", async () => {
    const { d, repo, c } = deps();
    const a = await newProblem(d, body);
    const b = await newProblem(d, body);
    expect([repo.problems.length, c.calls]).toEqual([1, 1]);
    expect(b.json).toEqual(a.json);
  });
  it("a resend after the first call died (> 2,5 min, no reply) runs the first turn again on the same problem", async () => {
    const at = new Date(NOW.getTime() - STALE_PENDING_MS - 1);
    const seed: Seed = { problems: [{ id: "p1", childId: "c1" }],
      messages: [{ problemId: "p1", role: "child", text: "Hai người thợ…", clientMsgId: body.clientMsgId, at }] };
    const { d, repo } = deps(seed);
    const r = await newProblem(d, body);
    expect(r.status).toBe(200);
    expect((r.json as { problemId: string }).problemId).toBe("p1");
    expect(repo.problems).toHaveLength(1);
  });
  it("the same resend within 2,5 minutes waits (409 pending)", async () => {
    const seed: Seed = { problems: [{ id: "p1", childId: "c1" }],
      messages: [{ problemId: "p1", role: "child", text: "x", clientMsgId: body.clientMsgId, at: new Date(NOW.getTime() - 10_000) }] };
    expect((await newProblem(deps(seed).d, body)).json).toEqual({ error: "pending" });
  });
  it("a parallel double tap: the loser's empty problem is abandoned", async () => {
    const { d, repo } = deps();
    await newProblem(d, body); // the winner
    repo.findByClientMsg = async () => null; // the loser checked before the winner inserted
    expect((await newProblem(d, body)).json).toEqual({ error: "pending" });
    expect(repo.problems.map((p) => p.status)).toEqual(["in_progress", "abandoned"]);
  });
  it("rejects an empty statement and an unknown stuck kind", async () => {
    const { d } = deps();
    expect((await newProblem(d, { ...body, statement: "  " })).status).toBe(400);
    expect((await newProblem(d, { ...body, stuckKind: "lam_bai_ho" })).status).toBe(400);
  });
  it("model down → 503 with a calm message; the empty problem is abandoned", async () => {
    const { d, repo } = deps({}, client(() => { throw Object.assign(new Error("x"), { status: 529 }); }));
    const r = await newProblem(d, body);
    expect(r).toEqual({ status: 503, json: { error: "model_unavailable", message: SAFE_BUSY } });
    expect(repo.problems[0]?.status).toBe("abandoned");
    expect(repo.messages).toEqual([]);
  });
});

describe("handleTurn", () => {
  const body = (n = 1, text = "Đúng rồi") => ({ problemId: "p1", clientMsgId: uuid(n), text });

  it("401 without a child session", async () => {
    expect((await handleTurn(deps(inProgress, client([confirm]), null).d, body())).status).toBe(401);
  });
  it("400 on a bad body (clientMsgId must be a uuid, text 1–2000 chars)", async () => {
    const { d } = deps(inProgress);
    expect((await handleTurn(d, { problemId: "p1", clientMsgId: "x", text: "a" })).status).toBe(400);
    expect((await handleTurn(d, { ...body(), text: "a".repeat(2001) })).status).toBe(400);
  });
  it("404 when the problem belongs to another child", async () => {
    const { d } = deps({ problems: [{ id: "p1", childId: "c2" }] });
    expect((await handleTurn(d, body())).status).toBe(404);
  });
  it("same clientMsgId twice → one model call, the same reply (idempotency)", async () => {
    const { d, c } = deps(inProgress, client([confirmed]));
    const a = await handleTurn(d, body());
    const b = await handleTurn(d, body());
    expect([a.status, b.json, c.calls]).toEqual([200, a.json, 1]);
  });
  it("history goes to the model; the statement is marked confirmed once the tutor says so", async () => {
    const seed: Seed = { ...inProgress, messages: [
      { problemId: "p1", role: "child", text: "đề bài…" }, { problemId: "p1", role: "tutor", text: "Cô đọc đề là…" }] };
    const { d, repo, c } = deps(seed, client([confirmed]));
    await handleTurn(d, body());
    expect(c.reqs[0]?.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(repo.problems[0]?.statementConfirmed).toBe(true);
  });
  it("409 pending while another message of this problem waits for its reply (< 2,5 min)", async () => {
    const seed: Seed = { ...inProgress, messages: [{ problemId: "p1", role: "child", text: "x", clientMsgId: uuid(9), at: new Date(NOW.getTime() - 30_000) }] };
    const { d, c } = deps(seed);
    expect((await handleTurn(d, body(1))).json).toEqual({ error: "pending" });
    expect((await handleTurn(d, body(9))).json).toEqual({ error: "pending" }); // the resend itself
    expect(c.calls).toBe(0);
  });
  it("a resend of a message stuck for more than 2,5 minutes runs the turn again (stored text is used)", async () => {
    const at = new Date(NOW.getTime() - STALE_PENDING_MS - 1);
    const seed: Seed = { ...inProgress, messages: [{ problemId: "p1", role: "child", text: "chữ cũ", clientMsgId: uuid(9), at }] };
    const { d, c } = deps(seed, client([confirmed]));
    const r = await handleTurn(d, body(9, "chữ mới"));
    expect(r.status).toBe(200);
    expect(c.reqs[0]?.messages.at(-1)?.content).toContain("chữ cũ");
  });
  it("a new message after a stuck one drops the stuck one", async () => {
    const at = new Date(NOW.getTime() - STALE_PENDING_MS - 1);
    const seed: Seed = { ...inProgress, messages: [{ problemId: "p1", role: "child", text: "kẹt", clientMsgId: uuid(9), at }] };
    const { d, repo } = deps(seed, client([confirmed]));
    expect((await handleTurn(d, body(1, "mới"))).status).toBe(200);
    expect(repo.messages.map((m) => m.text)).toEqual(["mới", JSON.parse(confirmed).message]);
  });
  it("turn 20 closes the problem as timed_out (D15); turn 21 is refused", async () => {
    const { d } = deps({ problems: [{ id: "p1", childId: "c1", turnCount: 19 }] }, client([confirmed]));
    const r = await handleTurn(d, body(1));
    expect((r.json as { status: string; turnCount: number })).toMatchObject({ status: "timed_out", turnCount: 20 });
    expect(await handleTurn(d, body(2))).toEqual({ status: 409, json: { error: "problem_closed", status: "timed_out" } });
  });
  it("two devices send at once: the later save loses (409 pending), one turn is counted, both calls are paid", async () => {
    const { d, repo } = deps(inProgress, client([confirmed]));
    // While this turn waits for the model, the other device saves turn 1 of the same problem.
    const racing = { create: async (req: object) => {
      repo.problems[0]!.turnCount = 1;
      return client([confirmed]).create(req);
    } };
    const r = await handleTurn({ ...d, client: racing }, body(1));
    expect(r).toEqual({ status: 409, json: { error: "pending" } });
    expect(repo.problems[0]?.turnCount).toBe(1);
    expect(repo.messages).toEqual([]); // this device's message was released for its retry
    expect(repo.usage.get("f1|2026-11-01")).toBeGreaterThan(0);
  });
  it("model down → 503, the child's message is released so the same resend works later", async () => {
    let fail = true;
    const c = { create: async (req: object) => { if (fail) throw Object.assign(new Error("x"), { status: 500 }); return client([confirmed]).create(req); } };
    const { d, repo } = deps(inProgress, client([confirmed]));
    const down = { ...d, client: c };
    expect((await handleTurn(down, body())).status).toBe(503);
    expect(repo.messages).toEqual([]);
    fail = false;
    expect((await handleTurn(down, body())).status).toBe(200);
  });
  it("an unreadable model reply is rewritten once; still unreadable → safe line, raw text kept", async () => {
    const { d, repo, c } = deps(inProgress, client(["xin chào"]));
    const r = await handleTurn(d, body());
    expect((r.json as { message: string }).message).toBe(safeLine(0).message);
    expect(c.calls).toBe(2);
    expect(repo.modelCalls.map((m) => [m.raw, m.guardResult])).toEqual([["xin chào", "blocked"], ["xin chào", "blocked"]]);
  });
  it("cost of every call (answer + check) goes to the family's month (UTC month)", async () => {
    const { d, repo } = deps(inProgress, client([confirmed]));
    await handleTurn(d, body());
    const u = { input_tokens: 1000, output_tokens: 100 };
    expect(repo.usage.get("f1|2026-11-01")).toBeCloseTo(costUsd("claude-sonnet-5-5", u) + costUsd("claude-haiku-5-5", u), 9);
  });
});

// G2 — the turn pipeline (DESIGN §4; DOMAIN §4.1, §4.2, §4.14, §5)
/** Scripted tutor replies and checker verdicts, in order; records which model each call used. */
function scripted(tutor: string[], guard: boolean[]) {
  const models: string[] = [];
  let ti = 0, gi = 0;
  return {
    models,
    async create(req: object) {
      const r = req as { model: string };
      models.push(r.model);
      const text = isGuardReq(req) ? JSON.stringify({ pass: guard[gi++] ?? true, ly_do: ["1: lộ đáp số"] }) : tutor[Math.min(ti++, tutor.length - 1)]!;
      return { content: [{ type: "text", text }], usage: { input_tokens: 100, output_tokens: 10 } };
    },
  };
}
const nanSeed: Seed = { ...inProgress, messages: [{ problemId: "p1", role: "tutor", text: "?" },
  { problemId: "p1", role: "child", text: "k" }, { problemId: "p1", role: "tutor", text: "?" }] };

describe("G2 turn pipeline", () => {
  const body = (n = 1, text = "Đúng rồi") => ({ problemId: "p1", clientMsgId: uuid(n), text });

  it("§4.14 a: normal turn → Sonnet answers, Haiku checks, the child sees Sonnet's answer", async () => {
    const c = scripted([confirmed], [true]);
    const { d, repo } = deps(inProgress, c);
    const r = await handleTurn(d, body());
    expect(r.status).toBe(200);
    expect(c.models).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5"]);
    expect(repo.modelCalls.map((m) => [m.purpose, m.routeReason, m.guardResult, m.shown]))
      .toEqual([["tutor", null, "pass", true], ["guard", null, null, false]]);
  });
  it("§4.14 d: blocked → rewritten on Opus; the child sees Opus' answer; the next turn stays on Opus", async () => {
    const c = scripted([confirm, confirmed, confirmed], [false, true, true]);
    const { d, repo } = deps(inProgress, c);
    const r = await handleTurn(d, body(1));
    expect(c.models).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5", "claude-haiku-5-5"]);
    expect((r.json as { message: string }).message).toBe(JSON.parse(confirmed).message);
    expect(repo.modelCalls.filter((m) => m.purpose === "tutor").map((m) => [m.routeReason, m.guardResult]))
      .toEqual([[null, "blocked"], ["guard_blocked", "rewritten"]]);
    await handleTurn(d, body(2));
    expect(c.models.at(-2)).toBe("claude-opus-5-5"); // sticky
    expect(repo.modelCalls.filter((m) => m.purpose === "tutor").at(-1)?.routeReason).toBe("sticky");
  });
  it("the rewrite tells the tutor why the checker blocked the answer", async () => {
    const reqs: { messages: { content: string }[] }[] = [];
    const c = scripted([confirm, confirmed], [false, true]);
    const spy = { create: (req: object) => { reqs.push(req as never); return c.create(req); } };
    const { d } = deps(inProgress, client([confirm]));
    await handleTurn({ ...d, client: spy }, body());
    expect(reqs[2]?.messages.at(-1)?.content).toMatch(/BỘ KIỂM TRA CỦA APP.*1: lộ đáp số/);
  });
  it("§5: blocked twice → the safe line for the hint level; both answers kept as blocked", async () => {
    const c = scripted([confirmed], [false, false]);
    const { d, repo } = deps({ problems: [{ id: "p1", childId: "c1", hintLevel: 2, hintLevelMax: 2 }] }, c);
    const r = await handleTurn(d, body());
    expect((r.json as { message: string; buttons: string[] })).toMatchObject(safeLine(2));
    expect(repo.modelCalls.filter((m) => m.purpose === "tutor").map((m) => m.guardResult)).toEqual(["blocked", "blocked"]);
    expect(repo.modelCalls.some((m) => m.shown)).toBe(false);
  });
  it("§5: the checker is down → fail-closed (rewrite, then safe line)", async () => {
    const c = { create: async (req: object) => {
      if (isGuardReq(req)) throw Object.assign(new Error("x"), { status: 529 });
      return { content: [{ type: "text", text: confirmed }], usage: { input_tokens: 100, output_tokens: 10 } };
    } };
    const { d, repo } = deps(inProgress, client([confirmed]));
    const r = await handleTurn({ ...d, client: c }, body());
    expect((r.json as { message: string }).message).toBe(safeLine(0).message);
    expect(repo.modelCalls.filter((m) => m.purpose === "guard").map((m) => m.guardReasons)).toEqual([["guard_unavailable"], ["guard_unavailable"]]);
  });
  it("turn budget: no time left for a rewrite → safe line straight away", async () => {
    let t = 0;
    const c = scripted([confirmed], [false]);
    const slow = { create: async (req: object) => { t += 100_000; return c.create(req); } };
    const { d } = deps(inProgress, client([confirmed]));
    const r = await handleTurn({ ...d, client: slow, clock: () => t }, body());
    expect(c.models).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5"]);
    expect((r.json as { message: string }).message).toBe(safeLine(0).message);
  });
  it("§4.1 c + §4.14 e: 'k' then 'ko biết' → H4 jump, nan_jumps + 1, answered on Opus (nan)", async () => {
    const c = scripted([confirmed], [true]);
    const { d, repo } = deps(nanSeed, c);
    const r = await handleTurn(d, body(1, "ko biết"));
    expect(c.models[0]).toBe("claude-opus-5-5");
    expect(repo.modelCalls[0]?.routeReason).toBe("nan");
    expect([repo.problems[0]?.hintLevel, repo.problems[0]?.hintLevelMax, repo.problems[0]?.nanJumps]).toEqual([4, 4, 1]);
    expect((r.json as { hintLevel: number }).hintLevel).toBe(4);
  });
  it("§4.2: three 'Chưa hiểu' presses in a row → nản", async () => {
    const seed: Seed = { ...inProgress, messages: [
      { problemId: "p1", role: "tutor", text: "giảng 1" },
      { problemId: "p1", role: "child", text: BTN_NOT_UNDERSTOOD, inputKind: "button" }, { problemId: "p1", role: "tutor", text: "giảng 2" },
      { problemId: "p1", role: "child", text: BTN_NOT_UNDERSTOOD, inputKind: "button" }, { problemId: "p1", role: "tutor", text: "giảng 3" }] };
    const c = scripted([confirmed], [true]);
    const { d, repo } = deps(seed, c);
    await handleTurn(d, { ...body(1, BTN_NOT_UNDERSTOOD), kind: "button" });
    expect(repo.modelCalls[0]?.routeReason).toBe("nan");
    expect(repo.messages.filter((m) => m.role === "child").at(-1)?.inputKind).toBe("button");
  });
  it("⑥ tells the tutor the jumped level, nan and max_lines", async () => {
    const { d, c } = deps(nanSeed, client([confirmed]));
    await handleTurn(d, body(1, "ko biết"));
    const sent = c.reqs[0]?.messages.at(-1)?.content ?? "";
    expect(sent).toContain("muc_goi_y: H4");
    expect(sent).toContain("nan: true");
    expect(sent).toContain("max_lines: 6");
  });
  it("§4.1 a: H0 and the tutor marks the answer wrong → H1, wrong_count 1", async () => {
    const wrong = JSON.stringify({ ...JSON.parse(confirmed), danh_gia_luot_em: "sai" });
    const { d, repo } = deps(inProgress, scripted([wrong], [true]));
    await handleTurn(d, body(1, "x = 5"));
    expect([repo.problems[0]?.hintLevel, repo.problems[0]?.wrongCount]).toEqual([1, 1]);
  });
  it("§4.14 b: H3 → Opus (hint_h3)", async () => {
    const c = scripted([confirmed], [true]);
    const { d, repo } = deps({ problems: [{ id: "p1", childId: "c1", hintLevel: 3, hintLevelMax: 3 }] }, c);
    await handleTurn(d, body());
    expect([c.models[0], repo.modelCalls[0]?.routeReason]).toEqual(["claude-opus-5-5", "hint_h3"]);
  });
  it("§4.14 c: the last answer the child saw was flagged tutor_unsure → Opus", async () => {
    const unsure = JSON.stringify({ ...JSON.parse(confirmed), flags: ["tutor_unsure"] });
    const c = scripted([confirmed], [true]);
    const { d, repo } = deps({ ...inProgress, calls: [{ problemId: "p1", raw: unsure, shown: true }] }, c);
    await handleTurn(d, body());
    expect(repo.modelCalls.at(-2)?.routeReason).toBe("tutor_unsure");
  });
  it("4.12 b: the tutor says self_solved on a submitted answer → still in_progress (no confirming math_check)", async () => {
    const solved = JSON.stringify({ ...JSON.parse(confirmed), ket_qua_bai: "self_solved" });
    const { d, repo, c } = deps(inProgress, client([solved]));
    await handleTurn(d, { ...body(1, "x = 24, y = 48"), kind: "submit" });
    expect(repo.problems[0]?.status).toBe("in_progress");
    expect(c.reqs[0]?.messages.at(-1)?.content).toContain("da_nop_loi_giai: true");
  });
  it("§5: the third off-topic turn closes the problem", async () => {
    const off = JSON.stringify({ ...JSON.parse(confirmed), flags: ["off_topic"] });
    const { d, repo } = deps({ problems: [{ id: "p1", childId: "c1", offtopicCount: 2 }] }, client([off]));
    const r = await handleTurn(d, body(1, "chơi game không cô"));
    expect((r.json as { status: string }).status).toBe("closed_offtopic");
    expect(repo.problems[0]?.offtopicCount).toBe(3);
  });
  it("D29: at 45 USD the month pauses Opus; a nản turn stays on Sonnet with reason opus_paused", async () => {
    const c = scripted([confirmed], [true]);
    const { d, repo } = deps({ ...nanSeed, usage: [{ month: "2026-11-01", costUsd: 45.2 }] }, c);
    await handleTurn(d, body(1, "ko"));
    expect(c.models[0]).toBe("claude-sonnet-5-5");
    expect(repo.modelCalls[0]?.routeReason).toBe("opus_paused");
    expect(repo.modes.get("f1|2026-11-01")).toBe("economy");
  });
  it("D29: paused month → a blocked answer is rewritten on Sonnet", async () => {
    const c = scripted([confirm, confirmed], [false, true]);
    const { d } = deps({ ...inProgress, usage: [{ month: "2026-11-01", costUsd: 1, mode: "economy" }] }, c);
    await handleTurn(d, body());
    expect(c.models).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]);
  });
});

describe("saveForLater", () => {
  it("closes the problem as saved_for_later; a resend is fine; a closed problem is refused", async () => {
    const { d, repo } = deps(inProgress);
    expect((await saveForLater(d, { problemId: "p1", clientMsgId: uuid(7) })).json).toEqual({ status: "saved_for_later" });
    expect((await saveForLater(d, { problemId: "p1", clientMsgId: uuid(7) })).status).toBe(200);
    expect((await saveForLater(d, { problemId: "p1", clientMsgId: uuid(8) })).status).toBe(409);
    expect(repo.problems[0]?.status).toBe("saved_for_later");
    expect(repo.messages.filter((m) => m.inputKind === "button")).toHaveLength(1);
    expect(repo.attentionSyncs).toHaveLength(1); // G7: the "cần chú ý" lines follow the ended problem
  });
  it("401 for a parent; 404 for another child's problem; 400 on a bad body", async () => {
    expect((await saveForLater(deps(inProgress, client([confirm]), { role: "parent", userId: "p", familyId: "f1" }).d,
      { problemId: "p1", clientMsgId: uuid(7) })).status).toBe(401);
    expect((await saveForLater(deps({ problems: [{ id: "p1", childId: "c2" }] }).d, { problemId: "p1", clientMsgId: uuid(7) })).status).toBe(404);
    expect((await saveForLater(deps(inProgress).d, { problemId: "p1" })).status).toBe(400);
  });
});

// G3 — photos (US1; DOMAIN §2 attachments, §5; decisions Q1–Q4 15/11/2026)
describe("G3 photos", () => {
  let photo: Uint8Array;
  beforeAll(async () => {
    photo = new Uint8Array(await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#ffffff" } })
      .withExif({ IFD0: { Make: "PhoneMaker" } }).jpeg().toBuffer());
  });
  const recordingClient = (texts = [confirm, confirmed]) => {
    const reqs: { system?: unknown; messages: { content: unknown }[] }[] = [];
    const inner = client(texts);
    return { reqs, create: async (req: object) => { reqs.push(req as never); return inner.create(req); } };
  };
  const hasImage = (x: unknown) => JSON.stringify(x).includes('"type":"image"');

  it("US1: a photo alone opens the problem; it is cleaned and stored; the tutor and the checker see it", async () => {
    const c = recordingClient();
    const { d, repo } = deps({}, c);
    const r = await newProblem(d, { clientMsgId: uuid(1), stuckKind: "", image: photo, device: "ipad" });
    expect(r.status).toBe(200);
    expect(repo.images).toHaveLength(1);
    expect(repo.messages[0]?.text).toBe(PHOTO_ONLY_TEXT);
    const stored = await sharp(Buffer.from(repo.images[0]!.data, "base64")).metadata();
    expect([stored.width, stored.height, stored.exif]).toEqual([1344, 896, undefined]); // ≤ 1568 px and ≤ 1568 tokens
    expect(repo.images[0]!.path).toMatch(/^c1\/p\d+\/f\d+\.jpg$/);
    expect(hasImage(c.reqs[0]!.messages.at(-1))).toBe(true); // tutor
    expect(typeof c.reqs[1]!.system).toBe("string");          // checker call…
    expect(hasImage(c.reqs[1])).toBe(true);                    // …sees the photo while the statement is unconfirmed
  });
  it("the photo stays on its own child message in later turns", async () => {
    const c = recordingClient();
    const { d, repo } = deps({}, c);
    await newProblem(d, { clientMsgId: uuid(1), stuckKind: null, image: photo });
    const problemId = repo.problems[0]!.id;
    await handleTurn(d, { problemId, clientMsgId: uuid(2), text: "Đúng rồi", kind: "button" });
    const turn2 = c.reqs[2]!.messages;
    expect(hasImage(turn2[0])).toBe(true);      // the first child message carries the photo
    expect(hasImage(turn2.at(-1))).toBe(false); // "Đúng rồi" has none
  });
  it("confirming the statement copies the tutor's restatement into confirmed_statement; the checker then reads words, not the photo", async () => {
    const seed: Seed = { ...inProgress, messages: [{ problemId: "p1", role: "child", text: PHOTO_ONLY_TEXT },
      { problemId: "p1", role: "tutor", text: "Cô đọc đề là: … Em kiểm tra giúp cô đúng chưa?" }] };
    seed.images = [{ problemId: "p1", messageId: "m1" }];
    const c = recordingClient([confirmed]);
    const { d, repo } = deps(seed, c);
    repo.images[0]!.messageId = repo.messages[0]!.id;
    await handleTurn(d, { problemId: "p1", clientMsgId: uuid(2), text: "Đúng rồi", kind: "button" });
    expect(repo.problems[0]?.confirmedStatement).toBe("Cô đọc đề là: … Em kiểm tra giúp cô đúng chưa?");
    await handleTurn(d, { problemId: "p1", clientMsgId: uuid(3), text: "x là thời gian người 1" });
    const lastGuard = c.reqs.filter((r) => typeof r.system === "string").at(-1);
    expect(hasImage(lastGuard)).toBe(false);
    expect(JSON.stringify(lastGuard)).toContain("Cô đọc đề là");
  });
  it("Q2: a photo of the work mid-problem is stored with that message; a 5th photo is refused", async () => {
    const seed: Seed = { ...inProgress, images: [1, 2, 3].map((n) => ({ problemId: "p1", messageId: `x${n}` })) };
    const { d, repo, c } = deps(seed, client([confirmed]));
    expect((await handleTurn(d, { problemId: "p1", clientMsgId: uuid(4), text: "", image: photo })).status).toBe(200);
    expect(repo.images).toHaveLength(4);
    const r = await handleTurn(d, { problemId: "p1", clientMsgId: uuid(5), text: "", image: photo });
    expect(r).toEqual({ status: 409, json: { error: "too_many_images", message: PHOTO_COPY.tooMany } });
    expect([repo.images.length, c.calls]).toEqual([4, 1]);
  });
  it("not an image → 415; too big → 413; nothing stored, no model call", async () => {
    const { d, repo, c } = deps(inProgress);
    expect((await handleTurn(d, { problemId: "p1", clientMsgId: uuid(6), text: "", image: new TextEncoder().encode("hello") })).status).toBe(415);
    expect((await handleTurn(d, TOO_BIG)).status).toBe(413);
    expect((await newProblem(d, { clientMsgId: uuid(7), stuckKind: null, image: new TextEncoder().encode("hi") })).status).toBe(415);
    expect([repo.messages.length, repo.images.length, repo.problems.length, c.calls]).toEqual([0, 0, 1, 0]);
  });
  it("an empty message with no photo is a bad request", async () => {
    const { d } = deps(inProgress);
    expect((await handleTurn(d, { problemId: "p1", clientMsgId: uuid(8), text: "  " })).status).toBe(400);
    expect((await newProblem(d, { clientMsgId: uuid(9), stuckKind: null, statement: "" })).status).toBe(400);
  });
  it("Storage down → 503 and the child's message is released", async () => {
    const { d, repo, c } = deps(inProgress, client([confirmed]));
    repo.saveImage = async () => { throw new Error("storage down"); };
    const r = await handleTurn(d, { problemId: "p1", clientMsgId: uuid(10), text: "bài làm", image: photo });
    expect(r.status).toBe(503);
    expect([repo.messages.length, c.calls]).toEqual([0, 0]);
  });
  it("model down after the photo was stored → the photo goes with the released message", async () => {
    const { d, repo } = deps(inProgress, client(() => { throw Object.assign(new Error("x"), { status: 529 }); }));
    expect((await handleTurn(d, { problemId: "p1", clientMsgId: uuid(11), text: "", image: photo })).status).toBe(503);
    expect([repo.messages.length, repo.images.length]).toEqual([0, 0]);
  });
  it("Q3 retake: replacesProblemId abandons the old unconfirmed problem; a confirmed one is kept", async () => {
    const { d, repo } = deps({ problems: [{ id: "old", childId: "c1" }, { id: "done", childId: "c1", statementConfirmed: true }] });
    await newProblem(d, { clientMsgId: uuid(12), stuckKind: null, image: photo, replacesProblemId: "00000000-0000-4000-8000-0000000000aa" });
    // ids in memory are not uuids: call the repo rule directly for the two cases
    expect(await repo.abandonUnconfirmed("old", "c1", NOW)).toBe(true);
    expect(await repo.abandonUnconfirmed("done", "c1", NOW)).toBe(false);
    expect(repo.problems.map((p) => p.status).slice(0, 2)).toEqual(["abandoned", "in_progress"]);
  });
});


// G4 — math_check, solve gate, sibling (DOMAIN §3.3, §4.12; Q1–Q4 phụ huynh chốt 15/11/2026)
describe("G4 tools in a turn", () => {
  const usage = { input_tokens: 100, output_tokens: 10 };
  const base1 = JSON.parse(confirmed) as Record<string, unknown>;
  const reply = (o: Record<string, unknown> = {}) => ({ content: [{ type: "text", text: JSON.stringify({ ...base1, ...o }) }], stop_reason: "end_turn", usage });
  const ask = (id: string, name: string, input: object) => ({ content: [{ type: "thinking", thinking: "…", signature: "s" }, { type: "tool_use", id, name, input }], stop_reason: "tool_use", usage });
  function world(o: { tutor: object[]; guard?: boolean[]; sibling?: object[] }) {
    const log: { kind: "tutor" | "guard" | "sibling"; model: string; req: Record<string, unknown> }[] = [];
    let ti = 0, gi = 0, si = 0;
    return {
      log,
      create: async (req: object) => {
        const r = req as { model: string; system?: unknown };
        const kind = typeof r.system !== "string" ? "tutor" : r.system.includes("BÀI ANH EM") ? "sibling" : "guard";
        log.push({ kind, model: r.model, req: JSON.parse(JSON.stringify(req)) });
        if (kind === "guard") return { content: [{ type: "text", text: JSON.stringify({ pass: o.guard?.[gi++] ?? true, ly_do: ["6: khẳng định khi chưa kiểm"] }) }], usage };
        if (kind === "sibling") return { content: [{ type: "text", text: JSON.stringify(o.sibling![Math.min(si++, o.sibling!.length - 1)]) }], usage };
        return o.tutor[Math.min(ti++, o.tutor.length - 1)] as never;
      },
    };
  }
  const fakeCas = (modes: Record<string, (a: Record<string, unknown>) => Record<string, unknown>>) =>
    ({ check: async (m: string, a: Record<string, unknown>) => (modes[m] ? { ok: true as const, result: modes[m]!(a) } : { ok: false as const, error: "timeout" }), health: async () => true });
  const submit = (n: number, text: string) => ({ problemId: "p1", clientMsgId: uuid(n), text, kind: "submit" });
  const simplify = { mode: "simplify_check", expr_a: "3/(3-sqrt(x))", expr_b: "sqrt(x)/(sqrt(x)-3) + 2*sqrt(x)/(sqrt(x)+3) - (3*x+9)/(x-9)" };

  it("4.12 a: the child submits, the tutor calls math_check, cas confirms, a checklist item was asked → self_solved", async () => {
    const w = world({ tutor: [ask("t1", "math_check", simplify), reply({ ket_qua_bai: "self_solved", danh_gia_luot_em: "dung", checklist_da_hoi: [7] })] });
    const { d, repo } = deps(inProgress, client([confirmed]));
    const cas = fakeCas({ simplify_check: () => ({ equivalent: true, fully_simplified: true, common_factor: null }) });
    const r = await handleTurn({ ...d, client: w, cas }, submit(1, "P = 3/(3 - √x)"));
    expect((r.json as { status: string }).status).toBe("self_solved");
    expect(repo.toolCalls).toEqual([expect.objectContaining({ tool: "math_check", ok: true })]);
    expect(repo.modelCalls[repo.toolCalls[0]!.callRow]?.shown).toBe(true); // linked to the answer the child saw
  });
  it("G7: a problem that ends rewrites the day's attention lines; a turn that stays open does not", async () => {
    const w = world({ tutor: [ask("t1", "math_check", simplify), reply({ ket_qua_bai: "self_solved", danh_gia_luot_em: "dung", checklist_da_hoi: [7] })] });
    const { d, repo } = deps(inProgress, client([confirmed]));
    const cas = fakeCas({ simplify_check: () => ({ equivalent: true, fully_simplified: true, common_factor: null }) });
    await handleTurn({ ...d, client: w, cas }, submit(1, "P = 3/(3 - √x)"));
    expect(repo.attentionSyncs).toEqual([{ familyId: "f1", childId: "c1", dateVn: "2026-11-14" }]);
    const open = deps(inProgress, client([confirmed]));
    await handleTurn(open.d, { problemId: "p1", clientMsgId: uuid(2), text: "x = 3", kind: "text" });
    expect(open.repo.attentionSyncs).toEqual([]);
  });
  it("G7c: self_solved → a reference solution is written, checked against the child's answer by cas, and stored (P4, X5)", async () => {
    const ref = { steps: ["ĐKXĐ: x ≥ 0, x ≠ 9", "Vậy P = 3/(3 − √x)"], final_answer: "P = 3/(3 − √x)", final_expr: "3/(3 - sqrt(x))", final_values: [] };
    const w = world({ tutor: [ask("t1", "math_check", simplify), reply({ ket_qua_bai: "self_solved", danh_gia_luot_em: "dung", checklist_da_hoi: [7] })] });
    const create = async (req: object) => (typeof (req as { system?: unknown }).system !== "string" && JSON.stringify(req).includes("LỜI GIẢI THAM KHẢO")
      ? { content: [{ type: "text", text: JSON.stringify(ref) }], stop_reason: "end_turn", usage } : w.create(req));
    const { d, repo } = deps(inProgress, client([confirmed]));
    const cas = fakeCas({ simplify_check: () => ({ equivalent: true, fully_simplified: true, common_factor: null }), equivalent: () => ({ equivalent: true }) });
    const r = await handleTurn({ ...d, client: { create }, cas, layers: { ...d.layers, reference: "Em là người viết LỜI GIẢI THAM KHẢO" } }, submit(1, "P = 3/(3 - √x)"));
    expect((r.json as { status: string }).status).toBe("self_solved");
    expect(await repo.getReference("p1", "c1")).toEqual({ steps: ref.steps, finalAnswer: "P = 3/(3 − √x)" });
    expect(repo.modelCalls.filter((c) => c.purpose === "reference")).toEqual([expect.objectContaining({ guardResult: "pass" })]);
    expect(await repo.getReference("p1", "c2")).toBeNull(); // another child
  });
  it("G7c: a reference whose answer cas does not confirm is not stored (logged as blocked)", async () => {
    const ref = { steps: ["…"], final_answer: "P = 1", final_expr: "1", final_values: [] };
    const w = world({ tutor: [ask("t1", "math_check", simplify), reply({ ket_qua_bai: "self_solved", danh_gia_luot_em: "dung", checklist_da_hoi: [7] })] });
    const create = async (req: object) => (JSON.stringify(req).includes("LỜI GIẢI THAM KHẢO")
      ? { content: [{ type: "text", text: JSON.stringify(ref) }], stop_reason: "end_turn", usage } : w.create(req));
    const { d, repo } = deps(inProgress, client([confirmed]));
    const cas = fakeCas({ simplify_check: () => ({ equivalent: true, fully_simplified: true, common_factor: null }), equivalent: () => ({ equivalent: false }) });
    await handleTurn({ ...d, client: { create }, cas, layers: { ...d.layers, reference: "Em là người viết LỜI GIẢI THAM KHẢO" } }, submit(1, "P = 3/(3 - √x)"));
    expect(await repo.getReference("p1", "c1")).toBeNull();
    expect(repo.modelCalls.filter((c) => c.purpose === "reference")).toEqual([expect.objectContaining({ guardResult: "blocked" })]);
  });
  it("G7: an attention failure never breaks the child's turn", async () => {
    const w = world({ tutor: [ask("t1", "math_check", simplify), reply({ ket_qua_bai: "self_solved", danh_gia_luot_em: "dung", checklist_da_hoi: [7] })] });
    const { d, repo } = deps(inProgress, client([confirmed]));
    repo.failAttention.on = true;
    const cas = fakeCas({ simplify_check: () => ({ equivalent: true, fully_simplified: true, common_factor: null }) });
    const r = await handleTurn({ ...d, client: w, cas }, submit(1, "P = 3/(3 - √x)"));
    expect(r.status).toBe(200);
    expect((r.json as { status: string }).status).toBe("self_solved");
  });
  it("4.12 b: self_solved proposed without a check → the app asks once; cas confirms → self_solved", async () => {
    const w = world({ tutor: [reply({ ket_qua_bai: "self_solved", checklist_da_hoi: [6] }), ask("t2", "math_check", { mode: "check_root", equation: "x - 4 = 0", value: "4" }),
      reply({ ket_qua_bai: "self_solved", checklist_da_hoi: [6] })] });
    const { d, repo } = deps(inProgress, client([confirmed]));
    const r = await handleTurn({ ...d, client: w, cas: fakeCas({ check_root: () => ({ is_root: true, undefined: false }) }) }, submit(1, "x = 4"));
    expect((r.json as { status: string }).status).toBe("self_solved");
    const tutorReqs = w.log.filter((x) => x.kind === "tutor");
    expect(tutorReqs).toHaveLength(3);
    expect(JSON.stringify(tutorReqs[1]!.req.messages)).toContain("[APP] Em đã nộp bài. Cô gọi math_check");
    expect(repo.toolCalls).toHaveLength(1);
  });
  it("4.12 c: equivalent but a common factor is left → the problem stays open", async () => {
    const w = world({ tutor: [ask("t1", "math_check", { ...simplify, expr_a: "(-3*sqrt(x)-9)/(x-9)" }), reply({ ket_qua_bai: "self_solved", checklist_da_hoi: [7] })] });
    const { d, repo } = deps(inProgress, client([confirmed]));
    const cas = fakeCas({ simplify_check: () => ({ equivalent: true, fully_simplified: false, common_factor: "sqrt(x) + 3" }) });
    await handleTurn({ ...d, client: w, cas }, submit(1, "P = (−3√x − 9)/(x − 9)"));
    expect(repo.problems[0]?.status).toBe("in_progress");
  });
  it("Q2: grade 9, cas confirms but no checklist item asked yet → stays open", async () => {
    const w = world({ tutor: [ask("t1", "math_check", simplify), reply({ ket_qua_bai: "self_solved", checklist_da_hoi: [] })] });
    const { d, repo } = deps(inProgress, client([confirmed]));
    await handleTurn({ ...d, client: w, cas: fakeCas({ simplify_check: () => ({ equivalent: true, fully_simplified: true }) }) }, submit(1, "P = 3/(3 - √x)"));
    expect(repo.problems[0]?.status).toBe("in_progress");
  });
  it("§4.12: cas not configured → the tool answers an error; tutor_unsure → the next turn goes to Opus", async () => {
    const w = world({ tutor: [ask("t1", "math_check", { mode: "check_root", equation: "x - 4 = 0", value: "4" }), reply({ flags: ["tutor_unsure"] }), reply({})] });
    const { d, repo } = deps(inProgress, client([confirmed]));
    await handleTurn({ ...d, client: w, cas: null }, body1(1, "x = 4"));
    expect(repo.toolCalls[0]).toMatchObject({ ok: false, output: { ok: false, error: "cas_not_configured" } });
    await handleTurn({ ...d, client: w, cas: null }, body1(2, "em làm lại rồi"));
    expect(repo.modelCalls.filter((c) => c.purpose === "tutor").at(-1)).toMatchObject({ model: "claude-opus-5-5", routeReason: "tutor_unsure" });
  });
  it("§3.3: nản → H4, the tutor shows a checked sibling; wrong again on the original → H5", async () => {
    const sib = { statement: "Hai vòi cùng chảy 12 giờ đầy bể; vòi I chảy 2 giờ, vòi II chảy 4 giờ được 25% bể. Hỏi mỗi vòi chảy riêng bao lâu?",
      solution_steps: ["Gọi x, y…", "Lập hệ…"], final_answer: "Vòi I 20 giờ, vòi II 30 giờ",
      check: { mode: "check_solution", equations: ["1/x+1/y=1/12", "2/x+4/y=1/4"], values: { x: "20", y: "30" } } };
    const seed: Seed = { ...nanSeed, messages: [{ problemId: "p1", role: "child", text: "Hai người thợ cùng làm 16 giờ thì xong…" }, ...nanSeed.messages!] };
    const w = world({ tutor: [ask("t1", "make_sibling", { original_statement: "Hai người thợ… 16 giờ…", ku_code: "T9.3", difficulty: "same" }),
      reply({ danh_gia_luot_em: "khong_biet" }), reply({ danh_gia_luot_em: "sai" })], sibling: [sib] });
    const { d, repo } = deps(seed, client([confirmed]));
    const cas = fakeCas({ check_solution: () => ({ satisfies: true, failed: [] }) });
    await handleTurn({ ...d, client: w, cas }, body1(1, "ko biết"));
    expect(repo.problems[0]?.hintLevel).toBe(4);
    expect(repo.toolCalls[0]).toMatchObject({ tool: "make_sibling", ok: true, output: { verified: true, numbers_differ: true } });
    expect(repo.modelCalls.some((c) => c.purpose === "sibling")).toBe(true);
    await handleTurn({ ...d, client: w, cas }, body1(2, "x = 30, y = 40"));
    expect(repo.problems[0]?.hintLevel).toBe(5);
  });
  it("the checker sees which tools ran and their results (guard rules 6–7)", async () => {
    const w = world({ tutor: [ask("t1", "math_check", simplify), reply({})] });
    const { d } = deps(inProgress, client([confirmed]));
    await handleTurn({ ...d, client: w, cas: fakeCas({ simplify_check: () => ({ equivalent: true, fully_simplified: false }) }) }, body1(1, "P = …"));
    const guardReq = JSON.stringify(w.log.find((x) => x.kind === "guard")!.req);
    expect(guardReq).toContain("math_check(simplify_check → equivalent=true, fully_simplified=false)");
  });
  it("the rewrite after a block may call tools too (on Opus)", async () => {
    const w = world({ tutor: [reply({}), ask("t9", "math_check", { mode: "check_root", equation: "x - 4 = 0", value: "4" }), reply({})], guard: [false, true] });
    const { d, repo } = deps(inProgress, client([confirmed]));
    await handleTurn({ ...d, client: w, cas: fakeCas({ check_root: () => ({ is_root: true }) }) }, body1(1, "x = 4"));
    expect(w.log.filter((x) => x.kind === "tutor").map((x) => x.model)).toEqual(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5-5"]);
    expect(repo.toolCalls).toHaveLength(1);
    expect(repo.modelCalls.find((c) => c.shown)?.guardResult).toBe("rewritten");
  });
  const body1 = (n: number, text: string) => ({ problemId: "p1", clientMsgId: uuid(n), text });
});

// G5 — knowledge card, classifier, background teaching, grade 6 checklist (DOMAIN §4.10b, §4.13, §4.14 h–i; phụ huynh chốt 16/11)
describe("G5 knowledge in a turn", () => {
  const usage = { input_tokens: 100, output_tokens: 10 };
  const base1 = JSON.parse(confirmed) as Record<string, unknown>;
  const out = (o: Record<string, unknown> = {}) => ({ content: [{ type: "text", text: JSON.stringify({ ...base1, ku_code_de_xuat: null, ...o }) }], stop_reason: "end_turn", usage });
  const ask = (id: string, name: string, input: object) => ({ content: [{ type: "thinking", thinking: "…", signature: "s" }, { type: "tool_use", id, name, input }], stop_reason: "tool_use", usage });
  const grade6 = { ...child, userId: "c1", grade: 6 as const, childCode: "HS-6A", maxLines: 4, profileText: "HỒ SƠ HS-6A" };
  function world(o: { classify?: object | Error; tutor: object[] }) {
    const log: { kind: "classify" | "tutor" | "guard"; model: string; req: Record<string, unknown> }[] = [];
    let ti = 0;
    return {
      log,
      create: async (req: object) => {
        const r = req as { model: string; system?: unknown };
        const kind = typeof r.system === "string" ? "guard" : JSON.stringify(r.system).includes("Em là bộ phân loại") ? "classify" : "tutor";
        log.push({ kind, model: r.model, req: JSON.parse(JSON.stringify(req)) });
        if (kind === "guard") return { content: [{ type: "text", text: JSON.stringify({ pass: true, ly_do: [] }) }], usage };
        if (kind === "classify") {
          if (o.classify instanceof Error) throw o.classify;
          return { content: [{ type: "text", text: JSON.stringify(o.classify ?? { ku_code: null, exam_slot: null, geometry_proof: false }) }], usage };
        }
        return o.tutor[Math.min(ti++, o.tutor.length - 1)] as never;
      },
    };
  }
  const start = (n: number, statement: string) => ({ clientMsgId: uuid(n), stuckKind: "khong_biet_bat_dau", statement });
  const turn = (n: number, text: string, kind = "text") => ({ problemId: "p1", clientMsgId: uuid(n), text, kind });
  const tutorCalls = (w: ReturnType<typeof world>) => w.log.filter((x) => x.kind === "tutor");
  const systemText = (req: Record<string, unknown>) => (req.system as { text: string }[]).map((b) => b.text).join("\n");

  it("§4.14 h: grade 9 proof, turn 1 → the classifier flags it → Opus (geometry_proof); KU, version and the classify call are stored", async () => {
    const w = world({ classify: { ku_code: "T9.16", exam_slot: null, geometry_proof: true }, tutor: [out({ de_da_xac_nhan: false })] });
    const { d, repo } = deps({}, client([confirm]));
    const r = await newProblem({ ...d, client: w, classify: true }, start(1, "Chứng minh MA là tiếp tuyến của (O)"));
    expect(r.status).toBe(200);
    expect(w.log.map((x) => [x.kind, x.model])).toEqual([["classify", "claude-haiku-5-5"], ["tutor", "claude-opus-5-5"], ["guard", "claude-haiku-5-5"]]);
    expect(repo.modelCalls.map((c) => [c.purpose, c.routeReason])).toEqual([["classify", null], ["tutor", "geometry_proof"], ["guard", null]]);
    expect(repo.problems[0]).toMatchObject({ kuCode: "T9.16", examSlot: null, knowledgeVersion: expect.stringMatching(/^\d{4}-/) });
  });
  it("§4.14 i: grade 6 geometry → Sonnet; ⑤ is the T6.20 card", async () => {
    const w = world({ classify: { ku_code: "T6.20", exam_slot: null, geometry_proof: true }, tutor: [out({ de_da_xac_nhan: false })] });
    const { d } = deps({}, client([confirm]), grade6);
    await newProblem({ ...d, client: w, classify: true }, start(1, "Tính chu vi hình chữ nhật dài 8 m rộng 5 m"));
    expect(tutorCalls(w)[0]!.model).toBe("claude-sonnet-5-5");
    expect(systemText(tutorCalls(w)[0]!.req)).toContain("T6.20 · Chu vi, diện tích các tứ giác đã học");
  });
  it("D27: exam slot HN10-2c on grade 9 → Opus (exam_slot_hard); ⑤ is the T9.9 card; ⑥ shows the slot", async () => {
    const w = world({ classify: { ku_code: "T9.9", exam_slot: "HN10-2c", geometry_proof: false }, tutor: [out({ de_da_xac_nhan: false })] });
    const { d, repo } = deps({}, client([confirm]));
    await newProblem({ ...d, client: w, classify: true }, start(1, "Bài II câu 3: tìm m để P = m có nghiệm"));
    expect(repo.modelCalls.find((c) => c.purpose === "tutor")).toMatchObject({ model: "claude-opus-5-5", routeReason: "exam_slot_hard" });
    expect(repo.problems[0]).toMatchObject({ kuCode: "T9.9", examSlot: "HN10-2c" });
    const req = tutorCalls(w)[0]!.req;
    expect(systemText(req)).toContain("T9.9 · Biến đổi đơn giản và rút gọn biểu thức chứa căn");
    expect(JSON.stringify(req.messages)).toContain("exam_slot: HN10-2c");
  });
  it("classifier down → unknown card, Sonnet, the turn is still answered", async () => {
    const w = world({ classify: Object.assign(new Error("x"), { status: 529 }), tutor: [out({ de_da_xac_nhan: false })] });
    const { d, repo } = deps({}, client([confirm]));
    const r = await newProblem({ ...d, client: w, classify: true }, start(1, "Rút gọn P"));
    expect(r.status).toBe(200);
    expect(tutorCalls(w)[0]!.model).toBe("claude-sonnet-5-5");
    expect(systemText(tutorCalls(w)[0]!.req)).toContain("[KIẾN THỨC — chưa xác định]");
    expect(repo.modelCalls.some((c) => c.purpose === "classify")).toBe(false);
  });
  it("later turns do not classify again; an in-progress problem keeps its card", async () => {
    const w = world({ tutor: [out({})] });
    const { d } = deps({ problems: [{ id: "p1", childId: "c1", sessionId: "s1", turnCount: 2, kuCode: "T9.9" }] }, client([confirm]));
    await handleTurn({ ...d, client: w, classify: true }, turn(1, "em chưa hiểu"));
    expect(w.log.map((x) => x.kind)).toEqual(["tutor", "guard"]);
    expect(systemText(tutorCalls(w)[0]!.req)).toContain("T9.9 ·");
  });
  it("§4.13 a: prereq_gap N8.02 → prereq_gaps [N8.02], one concept diagnosis on N8.02; ky_code of another grade is ignored", async () => {
    const w = world({ tutor: [out({ ky_thuat: "day_bu_nen", prereq_gap: "N8.02", goc_loi_du_doan: "concept", goc_loi_da_kiem_tra: true }), out({ prereq_gap: "TH.05" })] });
    const { d, repo } = deps({ problems: [{ id: "p1", childId: "c1", sessionId: "s1", turnCount: 2, kuCode: "T9.9", statementConfirmed: true }] }, client([confirm]));
    await handleTurn({ ...d, client: w, classify: true }, turn(1, "em không biết x − 9 tách thế nào"));
    expect(repo.problems[0]?.prereqGaps).toEqual(["N8.02"]);
    expect(repo.diagnoses).toEqual([expect.objectContaining({ root: "concept", source: "verified", kuCode: "N8.02", problemId: "p1" })]);
    await handleTurn({ ...d, client: w, classify: true }, turn(2, "à em hiểu rồi"));
    expect(repo.problems[0]?.prereqGaps).toEqual(["N8.02"]); // TH.05 is a grade 6 code
  });
  it("§4.13 b: after 2 bridge turns in a row the state block says 2/2 — quay lại bài gốc", async () => {
    const w = world({ tutor: [out({ ky_thuat: "day_bu_nen", prereq_gap: "N8.02" }), out({ ky_thuat: "day_bu_nen" }), out({})] });
    const { d } = deps({ problems: [{ id: "p1", childId: "c1", sessionId: "s1", turnCount: 2, kuCode: "T9.9", statementConfirmed: true }] }, client([confirm]));
    await handleTurn({ ...d, client: w }, turn(1, "em không biết tách"));
    await handleTurn({ ...d, client: w }, turn(2, "a² − b² là gì ạ"));
    expect(JSON.stringify(tutorCalls(w)[1]!.req.messages)).toContain("day_bu_nen: 1/2");
    await handleTurn({ ...d, client: w }, turn(3, "(a − b)(a + b)"));
    expect(JSON.stringify(tutorCalls(w)[2]!.req.messages)).toContain("day_bu_nen: 2/2 — đã đủ, quay lại bài gốc");
  });
  it("the KU changes only when the tutor confirms the statement (or when it was unknown)", async () => {
    const w = world({ classify: { ku_code: "T9.8", exam_slot: null, geometry_proof: false },
      tutor: [out({ de_da_xac_nhan: false, ku_code_de_xuat: "T9.7" }), out({ de_da_xac_nhan: true, ku_code_de_xuat: "T9.9" }), out({ ku_code_de_xuat: "T9.4" })] });
    const { d, repo } = deps({}, client([confirm]));
    const r = await newProblem({ ...d, client: w, classify: true }, start(1, "Rút gọn P = …"));
    const pid = (r.json as { problemId: string }).problemId;
    expect(repo.problems[0]?.kuCode).toBe("T9.8");
    await handleTurn({ ...d, client: w, classify: true }, { ...turn(2, "Đúng rồi", "button"), problemId: pid });
    expect(repo.problems[0]?.kuCode).toBe("T9.9");
    await handleTurn({ ...d, client: w, classify: true }, { ...turn(3, "em làm tiếp"), problemId: pid });
    expect(repo.problems[0]?.kuCode).toBe("T9.9");
  });
  it("§4.10b: grade 6 submits, cas confirms, no checklist item asked → stays open; item 3 asked → self_solved", async () => {
    const cas = { check: async () => ({ ok: true as const, result: { equivalent: true } }), health: async () => true };
    const lcm = { mode: "equivalent", expr_a: "105", expr_b: "lcm(3, 5, 7)" };
    const w = world({ tutor: [ask("t1", "math_check", lcm), out({ ket_qua_bai: "self_solved", danh_gia_luot_em: "dung", checklist_da_hoi: [] }),
      ask("t2", "math_check", lcm), out({ ket_qua_bai: "self_solved", danh_gia_luot_em: "dung", checklist_da_hoi: [3] })] });
    const { d, repo } = deps({ problems: [{ id: "p1", childId: "c1", sessionId: "s1", turnCount: 3, kuCode: "T6.12", statementConfirmed: true }] }, client([confirm]), grade6);
    await handleTurn({ ...d, client: w, cas }, turn(1, "Số bông là 105", "submit"));
    expect(repo.problems[0]?.status).toBe("in_progress");
    await handleTurn({ ...d, client: w, cas }, turn(2, "105 nằm trong khoảng 100 đến 120 ạ", "submit"));
    expect(repo.problems[0]?.status).toBe("self_solved");
  });
  it("lookup runs and the checker sees it", async () => {
    const w = world({ tutor: [ask("t1", "lookup", { code: "N8.02" }), out({})] });
    const { d, repo } = deps({ problems: [{ id: "p1", childId: "c1", sessionId: "s1", turnCount: 2, kuCode: "T9.9" }] }, client([confirm]));
    await handleTurn({ ...d, client: w }, turn(1, "em quên hằng đẳng thức"));
    expect(repo.toolCalls[0]).toMatchObject({ tool: "lookup", ok: true });
    const toolResult = JSON.stringify(tutorCalls(w)[1]!.req.messages);
    expect(toolResult).toContain("Hằng đẳng thức đáng nhớ");
    expect(JSON.stringify(w.log.find((x) => x.kind === "guard")!.req)).toContain("lookup(N8.02 → ok)");
  });
});

// G8-fix (24/11/2026) — from real use: the child saw "Mình đọc lại đề cùng nhau nhé…" again and again (the checker
// blocked the tutor's comments on a figure twice per turn), and did not find where to send the photo of the figure.
describe("G8-fix: safe lines, the figure photo, the confirmed statement", () => {
  let photo: Uint8Array;
  beforeAll(async () => {
    photo = new Uint8Array(await sharp({ create: { width: 800, height: 600, channels: 3, background: "#ffffff" } }).jpeg().toBuffer());
  });
  const body = (n: number, text = "em vẽ xong rồi") => ({ problemId: "p1", clientMsgId: uuid(n), text });
  const hasImage = (x: unknown) => JSON.stringify(x).includes('"type":"image"');

  it("blocked twice on three turns in a row → three different lines, then the teacher", async () => {
    const c = scripted([confirmed], Array(8).fill(false));
    const { d } = deps(inProgress, c);
    const shown = [];
    for (const n of [1, 2, 3, 4]) shown.push(((await handleTurn(d, body(n))).json as { message: string; buttons: string[] }));
    expect(shown.map((x) => x.message)).toEqual([safeLine(0).message, SAFE_AGAIN, SAFE_STOP, SAFE_STOP]);
    expect(shown.slice(1).every((x) => x.buttons.includes(BTN_SAVE))).toBe(true);
  });
  it("a normal answer between two safe lines starts the count again", async () => {
    const c = scripted([confirmed], [false, false, true, false, false]);
    const { d } = deps(inProgress, c);
    const a = (await handleTurn(d, body(1))).json as { message: string };
    const b = (await handleTurn(d, body(2))).json as { message: string };
    const e = (await handleTurn(d, body(3))).json as { message: string };
    expect([a.message, b.message, e.message]).toEqual([safeLine(0).message, JSON.parse(confirmed).message, safeLine(0).message]);
  });
  it("the checker sees the figure the child sent with this turn, even after the statement was confirmed", async () => {
    const reqs: object[] = [];
    const inner = client([confirmed]);
    const c = { create: async (req: object) => { reqs.push(req); return inner.create(req); } };
    const seed: Seed = { problems: [{ id: "p1", childId: "c1", sessionId: "s1", statementConfirmed: true, confirmedStatement: "Cho tam giác ABC…" }] };
    const { d } = deps(seed, c);
    expect((await handleTurn(d, { problemId: "p1", clientMsgId: uuid(1), text: "", image: photo })).status).toBe(200);
    const guard = reqs.filter(isGuardReq);
    expect(guard).toHaveLength(1);
    expect(hasImage(guard[0])).toBe(true);
  });
  it("the problem photo of the first turn goes to the checker once, not twice", async () => {
    const reqs: object[] = [];
    const inner = client([confirm]);
    const { d } = deps({}, { create: async (req: object) => { reqs.push(req); return inner.create(req); } });
    expect((await newProblem(d, { clientMsgId: uuid(1), stuckKind: null, image: photo })).status).toBe(200);
    expect(JSON.stringify(reqs.filter(isGuardReq)[0]).split('"type":"image"').length - 1).toBe(1);
  });
  it("⑥ tells the tutor the statement is already confirmed (no second 'đúng chưa?')", async () => {
    const reqs: { messages: { content: unknown }[] }[] = [];
    const inner = client([confirmed]);
    const c = { create: async (req: object) => { reqs.push(req as never); return inner.create(req); } };
    const seed: Seed = { problems: [{ id: "p1", childId: "c1", sessionId: "s1", statementConfirmed: true, confirmedStatement: "…" }] };
    const { d } = deps(seed, c);
    await handleTurn(d, body(1));
    expect(JSON.stringify(reqs[0]!.messages.at(-1))).toContain("de_da_xac_nhan: true");
  });
  it("geometry lesson → 6 photos per problem; other lessons stay at 4", async () => {
    const six = (kuCode: string): Seed => ({ problems: [{ id: "p1", childId: "c1", sessionId: "s1", kuCode }],
      images: [1, 2, 3, 4].map((n) => ({ problemId: "p1", messageId: `x${n}` })) });
    const geo = deps(six("T9.27"), client([confirmed]));
    expect((await handleTurn(geo.d, { problemId: "p1", clientMsgId: uuid(1), text: "", image: photo })).status).toBe(200);
    expect((await handleTurn(geo.d, { problemId: "p1", clientMsgId: uuid(2), text: "", image: photo })).status).toBe(200);
    expect((await handleTurn(geo.d, { problemId: "p1", clientMsgId: uuid(3), text: "", image: photo })).status).toBe(409);
    expect(geo.repo.images).toHaveLength(6);
    const alg = deps(six("T9.9"), client([confirmed]));
    expect((await handleTurn(alg.d, { problemId: "p1", clientMsgId: uuid(4), text: "", image: photo })).status).toBe(409);
  });
});

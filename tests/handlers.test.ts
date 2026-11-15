import { describe, expect, it } from "vitest";
import { handleTurn, newProblem, startSession, STALE_PENDING_MS, type Deps } from "@/lib/tutor/handlers";
import { SAFE_BUSY, SAFE_REPLY } from "@/lib/copy";
import { memoryRepo, type Seed } from "./helpers/memoryRepo";
import fewshot from "./fixtures/fewshot.json";

const child = { role: "child" as const, userId: "c1", familyId: "f1", grade: 9 as const, childCode: "HS-9A",
  maxLines: 6, profileVersion: 1, profileText: "HỒ SƠ HS-9A" };
const NOW = new Date("2026-11-14T10:05:00Z");
const confirm = JSON.stringify((fewshot as object[])[0]); // Mẫu 1: xác nhận đề, de_da_xac_nhan = false
const confirmed = JSON.stringify((fewshot as object[])[1]); // de_da_xac_nhan = true

function client(texts: string[] | (() => never)) {
  let calls = 0;
  const reqs: { messages: { role: string; content: string }[] }[] = [];
  return {
    get calls() { return calls; },
    reqs,
    async create(req: object) {
      calls++;
      reqs.push(req as never);
      if (typeof texts === "function") texts();
      const text = (texts as string[])[Math.min(calls - 1, (texts as string[]).length - 1)] ?? "";
      return { content: [{ type: "text", text }], usage: { input_tokens: 1000, output_tokens: 100 } };
    },
  };
}

function deps(seed: Seed = {}, c = client([confirm]), actor: Deps["actor"] = child) {
  const repo = memoryRepo(seed);
  const d: Deps = { repo, client: c, actor, now: NOW, layers: { role: "①", rules: "②", method: "③" },
    promptVersion: "v0.2", modelMain: "claude-sonnet-5-5" };
  return { d, repo, c };
}
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
      turnCount: 3, hintLevel: 0, wrongCount: 0, stuckKind: null, statementConfirmed: true });
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
  it("a resend after the first call died (> 2 min, no reply) runs the first turn again on the same problem", async () => {
    const at = new Date(NOW.getTime() - STALE_PENDING_MS - 1);
    const seed: Seed = { problems: [{ id: "p1", childId: "c1" }],
      messages: [{ problemId: "p1", role: "child", text: "Hai người thợ…", clientMsgId: body.clientMsgId, at }] };
    const { d, repo } = deps(seed);
    const r = await newProblem(d, body);
    expect(r.status).toBe(200);
    expect((r.json as { problemId: string }).problemId).toBe("p1");
    expect(repo.problems).toHaveLength(1);
  });
  it("the same resend within 2 minutes waits (409 pending)", async () => {
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
  it("409 pending while another message of this problem waits for its reply (< 2 min)", async () => {
    const seed: Seed = { ...inProgress, messages: [{ problemId: "p1", role: "child", text: "x", clientMsgId: uuid(9), at: new Date(NOW.getTime() - 30_000) }] };
    const { d, c } = deps(seed);
    expect((await handleTurn(d, body(1))).json).toEqual({ error: "pending" });
    expect((await handleTurn(d, body(9))).json).toEqual({ error: "pending" }); // the resend itself
    expect(c.calls).toBe(0);
  });
  it("a resend of a message stuck for more than 2 minutes runs the turn again (stored text is used)", async () => {
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
    const c = { create: async () => { if (fail) throw Object.assign(new Error("x"), { status: 500 }); return client([confirmed]).create({}); } };
    const { d, repo } = deps(inProgress, client([confirmed]));
    const down = { ...d, client: c };
    expect((await handleTurn(down, body())).status).toBe(503);
    expect(repo.messages).toEqual([]);
    fail = false;
    expect((await handleTurn(down, body())).status).toBe(200);
  });
  it("an unreadable model reply still answers with a safe line and keeps the raw text", async () => {
    const { d, repo } = deps(inProgress, client(["xin chào"]));
    const r = await handleTurn(d, body());
    expect((r.json as { message: string }).message).toBe(SAFE_REPLY);
    expect(repo.modelCalls[0]?.raw).toBe("xin chào");
  });
  it("cost goes to the family's month (UTC month)", async () => {
    const { d, repo } = deps(inProgress, client([confirmed]));
    await handleTurn(d, body());
    expect(repo.usage.get("f1|2026-11-01")).toBeCloseTo((1000 * 2 + 100 * 10) / 1e6, 9);
  });
});

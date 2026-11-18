// G7c — money pushes through the Launcher (D23: ~45 USD, Console out of money, forecast over the cap).
import { describe, expect, it } from "vitest";
import { handleTurn, type Deps } from "@/lib/tutor/handlers";
import { SPEND_PAUSED } from "@/lib/copy";
import { memoryRepo, type Seed } from "./helpers/memoryRepo";
import fewshot from "./fixtures/fewshot.json";

const child = { role: "child" as const, userId: "c1", familyId: "f1", grade: 9 as const, childCode: "HS-9A", maxLines: 6, profileVersion: 1, profileText: "HỒ SƠ" };
const confirmed = JSON.stringify((fewshot as object[])[1]);
const PASS = JSON.stringify({ pass: true, ly_do: [] });
const MODELS = { main: "claude-sonnet-5-5", strong: "claude-opus-5-5", light: "claude-haiku-5-5" };
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const seedP: Seed = { problems: [{ id: "p1", childId: "c1", sessionId: "s1", statementConfirmed: true }] };

const okClient = {
  async create(req: object) {
    const guard = typeof (req as { system?: unknown }).system === "string";
    return { content: [{ type: "text", text: guard ? PASS : confirmed }], usage: { input_tokens: 1000, output_tokens: 100 } };
  },
};
function deps(seed: Seed, now: Date, client: Deps["client"] = okClient, notifyOk = true) {
  const repo = memoryRepo(seed);
  const sent: { kind: string; familyId: string; forecastUsd?: number }[] = [];
  const d: Deps = { repo, client, actor: child, now, promptVersion: "v", models: MODELS, cas: null,
    layers: { role: "①", rules: "②", method: "③", guard: "Em là bộ kiểm tra", sibling: "BÀI ANH EM", classify: "phân loại" },
    notify: async (kind, familyId, forecastUsd) => {
      sent.push({ kind, familyId, ...(forecastUsd !== undefined ? { forecastUsd } : {}) });
      return notifyOk;
    } };
  return { d, repo, sent };
}
const turn = (n: number) => ({ problemId: "p1", clientMsgId: uuid(n), text: "x = 3", kind: "text" });

describe("§4.5 b: ~45 USD pauses Opus and tells the parents once", () => {
  it("first paused turn → one 'economy' push; later turns → none", async () => {
    const now = new Date("2026-11-03T10:00:00Z");
    const { d, repo, sent } = deps({ ...seedP, usage: [{ month: "2026-11-01", costUsd: 45.1 }] }, now);
    await handleTurn(d, turn(1));
    await handleTurn(d, turn(2));
    expect(sent).toEqual([{ kind: "economy", familyId: "f1" }]);
    expect(repo.alerts.get("f1|2026-11-01|economy")).toEqual(now);
  });
  it("the push failed → not marked, the next turn tries again", async () => {
    const now = new Date("2026-11-03T10:00:00Z");
    const { d, repo, sent } = deps({ ...seedP, usage: [{ month: "2026-11-01", costUsd: 45.1 }] }, now, okClient, false);
    await handleTurn(d, turn(1));
    await handleTurn(d, turn(2));
    expect(sent.filter((x) => x.kind === "economy")).toHaveLength(2);
    expect(repo.alerts.size).toBe(0);
  });
});

describe("§4.5 b2: forecast over the cap → one push a week (from day 5, X2)", () => {
  it("day 10, 20 USD spent → 'burn' with the forecast; the next turn the same day → none", async () => {
    const now = new Date("2026-11-10T10:00:00Z");
    const { d, sent } = deps({ ...seedP, usage: [{ month: "2026-11-01", costUsd: 20 }] }, now);
    await handleTurn(d, turn(1));
    await handleTurn(d, turn(2));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: "burn", familyId: "f1" });
    expect(sent[0]!.forecastUsd).toBeGreaterThan(60);
  });
  it("well under the cap → nothing", async () => {
    const { d, sent } = deps({ ...seedP, usage: [{ month: "2026-11-01", costUsd: 5 }] }, new Date("2026-11-10T10:00:00Z"));
    await handleTurn(d, turn(1));
    expect(sent).toEqual([]);
  });
});

describe("§4.5 d: Console out of money", () => {
  const limited = { async create() { throw Object.assign(new Error("400 You have reached your specified workspace API usage limits."), { status: 400 }); } };
  it("the child is told the tutor is resting; the parents get one push a day; the message is freed", async () => {
    const now = new Date("2026-11-20T10:00:00Z");
    const { d, repo, sent } = deps(seedP, now, limited);
    const r = await handleTurn(d, turn(1));
    expect(r).toEqual({ status: 503, json: { error: "spend_limit", message: SPEND_PAUSED } });
    await handleTurn(d, turn(2));
    expect(sent).toEqual([{ kind: "console_blocked", familyId: "f1" }]);
    expect(repo.messages.filter((m) => m.role === "child")).toHaveLength(0);
  });
  it("another API error stays a plain 'busy' with no push", async () => {
    const down = { async create() { throw Object.assign(new Error("529 overloaded"), { status: 529 }); } };
    const { d, sent } = deps(seedP, new Date("2026-11-20T10:00:00Z"), down);
    expect((await handleTurn(d, turn(1))).json).toMatchObject({ error: "model_unavailable" });
    expect(sent).toEqual([]);
  });
});

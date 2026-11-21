// G7b — Kết thúc buổi (§3.1), con chấm cô (US6, P2), luật dạy theo phiên bản buổi (§3.4, US8).
import { describe, expect, it } from "vitest";
import { endSession, handleTurn, rateSession, startSession, type Deps } from "@/lib/tutor/handlers";
import { memoryRepo, type Seed } from "./helpers/memoryRepo";
import fewshot from "./fixtures/fewshot.json";

const child = { role: "child" as const, userId: "c1", familyId: "f1", grade: 9 as const, childCode: "HS-9A",
  maxLines: 6, profileVersion: 1, profileText: "HỒ SƠ HS-9A" };
const parent = { role: "parent" as const, userId: "pa", familyId: "f1" };
const NOW = new Date("2026-11-14T10:05:00Z");
const confirm = JSON.stringify((fewshot as object[])[0]);
const PASS = JSON.stringify({ pass: true, ly_do: [] });
const MODELS = { main: "claude-sonnet-5-5", strong: "claude-opus-5-5", light: "claude-haiku-5-5" };

function client() {
  const tutorReqs: { system: { text: string }[] }[] = [];
  return {
    tutorReqs,
    async create(req: object) {
      const usage = { input_tokens: 10, output_tokens: 10 };
      if (typeof (req as { system?: unknown }).system === "string") return { content: [{ type: "text", text: PASS }], usage };
      tutorReqs.push(req as never);
      return { content: [{ type: "text", text: confirm }], usage };
    },
  };
}
function deps(seed: Seed = {}, actor: Deps["actor"] = child, now = NOW) {
  const repo = memoryRepo(seed);
  const c = client();
  const d: Deps = { repo, client: c, actor, now, promptVersion: "v0.7", models: MODELS, cas: null,
    layers: { role: "①", rules: "②", method: "③", guard: "Em là bộ kiểm tra", sibling: "BÀI ANH EM", classify: "phân loại" } };
  return { d, repo, c };
}
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("rules version (§3.4: a session uses the rules of its start; US8 from the next session)", () => {
  it("a new session pins the highest approved version", async () => {
    const { d, repo } = deps({ rules: [{ id: "a", version: 1 }, { id: "b", version: 3 }, { id: "c", version: 0, status: "proposed" }] });
    await startSession(d, { device: "ipad" });
    expect(repo.sessions[0]?.rulesVersion).toBe(3);
  });
  it("no rules → version 0 and layer ④ is the profile only", async () => {
    const { d, c } = deps({ sessions: [{ id: "s1" }], problems: [{ id: "p1", childId: "c1", sessionId: "s1" }] });
    await handleTurn(d, { problemId: "p1", clientMsgId: uuid(1), text: "x = 3", kind: "text" });
    expect(c.tutorReqs[0]?.system[3]?.text).toBe("HỒ SƠ HS-9A");
  });
  it("layer ④ carries the rules pinned by the session; a rule approved later waits for the next session", async () => {
    const seed: Seed = {
      sessions: [{ id: "s1", rulesVersion: 1 }],
      problems: [{ id: "p1", childId: "c1", sessionId: "s1" }],
      rules: [{ id: "a", version: 1, text: "Mỗi lượt chỉ hỏi con một câu." }, { id: "b", version: 2, text: "Luật duyệt giữa buổi." }],
    };
    const { d, c } = deps(seed);
    await handleTurn(d, { problemId: "p1", clientMsgId: uuid(1), text: "x = 3", kind: "text" });
    const layer4 = c.tutorReqs[0]?.system[3]?.text ?? "";
    expect(layer4).toContain("HỒ SƠ HS-9A\n\n[LUẬT BỐ MẸ ĐÃ DUYỆT");
    expect(layer4).toContain("- Mỗi lượt chỉ hỏi con một câu.");
    expect(layer4).not.toContain("Luật duyệt giữa buổi.");
  });
});

describe("endSession (§3.1 Kết thúc buổi)", () => {
  const seed: Seed = { sessions: [{ id: "s1" }], problems: [{ id: "p1", childId: "c1", sessionId: "s1" }, { id: "p2", childId: "c1", sessionId: "s1", status: "self_solved" }] };
  it("ends the session; open problems become timed_out (to continue later); a second press is fine", async () => {
    const { d, repo } = deps(seed);
    expect((await endSession(d, { sessionId: "s1" })).json).toEqual({ status: "ended", rated: false });
    expect(repo.sessions[0]?.status).toBe("ended");
    expect(repo.problems.map((p) => p.status)).toEqual(["timed_out", "self_solved"]);
    expect((await endSession(d, { sessionId: "s1" })).json).toEqual({ status: "already", rated: false });
    expect(repo.attentionSyncs).toHaveLength(1);
  });
  it("another child's session → 404; a parent → 401; bad body → 400", async () => {
    expect((await endSession(deps({ sessions: [{ id: "s1", childId: "c2" }] }).d, { sessionId: "s1" })).status).toBe(404);
    expect((await endSession(deps(seed, parent).d, { sessionId: "s1" })).status).toBe(401);
    expect((await endSession(deps(seed).d, {})).status).toBe(400);
  });
  it("after ending, the next problem opens a NEW session the same day", async () => {
    const { d, repo } = deps(seed);
    await endSession(d, { sessionId: "s1" });
    expect((await startSession(d, { device: "ipad" })).json).toMatchObject({ reused: false });
    expect(repo.sessions).toHaveLength(2);
  });
});

describe("rateSession (US6 one tap, P2 once per session, P3 😕 twice → rule)", () => {
  const seed: Seed = { sessions: [{ id: "s1" }] };
  it("one tap saves; reasons sent within 2 minutes complete it; later → already", async () => {
    const { d, repo } = deps(seed);
    expect((await rateSession(d, { sessionId: "s1", face: "ok" })).json).toEqual({ status: "saved" });
    expect((await rateSession(d, { sessionId: "s1", face: "ok", reasons: ["clear"] })).json).toEqual({ status: "updated" });
    expect(repo.ratings[0]).toMatchObject({ face: "ok", reasons: ["clear"] });
    const later = { ...d, now: new Date(NOW.getTime() + 3 * 60_000) };
    expect((await rateSession(later, { sessionId: "s1", face: "hard" })).json).toEqual({ status: "already" });
    expect(repo.ratings).toHaveLength(1);
  });
  it("a rating rewrites the day's attention lines (😕 is a flag, §4.7)", async () => {
    const { d, repo } = deps(seed);
    await rateSession(d, { sessionId: "s1", face: "hard", reasons: ["too_long"] });
    expect(repo.attentionSyncs).toEqual([{ familyId: "f1", childId: "c1", dateVn: "2026-11-14" }]);
  });
  it("😕 in two sessions in a row with the same reason → one proposed rule (X4 sentence)", async () => {
    const { d, repo } = deps({ sessions: [{ id: "s0" }, { id: "s1" }], ratings: [{ sessionId: "s0", face: "hard", reasons: ["too_long"] }] });
    await rateSession(d, { sessionId: "s1", face: "hard", reasons: ["too_long", "hard_words"] });
    expect(repo.rules).toEqual([expect.objectContaining({
      status: "proposed", version: 0, source: "child_rating", sourceKey: "rating:too_long",
      text: "Trả lời ngắn hơn: mỗi lượt một ý, tối đa 3 dòng.", sourceIds: [repo.ratings[1]!.id, repo.ratings[0]!.id],
    })]);
    await rateSession(d, { sessionId: "s1", face: "hard", reasons: ["too_long"] }); // completing it does not propose twice
    expect(repo.rules).toHaveLength(1);
  });
  it("unknown reasons, long comments, other children, parents → refused", async () => {
    expect((await rateSession(deps(seed).d, { sessionId: "s1", face: "hard", reasons: ["boring"] })).status).toBe(400);
    expect((await rateSession(deps(seed).d, { sessionId: "s1", face: "hard", comment: "x".repeat(501) })).status).toBe(400);
    expect((await rateSession(deps(seed).d, { sessionId: "s1", face: "meh" })).status).toBe(400);
    expect((await rateSession(deps({ sessions: [{ id: "s1", childId: "c2" }] }).d, { sessionId: "s1", face: "ok" })).status).toBe(404);
    expect((await rateSession(deps(seed, parent).d, { sessionId: "s1", face: "ok" })).status).toBe(401);
  });
});

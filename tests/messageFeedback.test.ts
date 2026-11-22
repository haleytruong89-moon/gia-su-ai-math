import { describe, expect, it } from "vitest";
import { flagMessage } from "@/lib/tutor/feedback";
import { rateSession, type Deps } from "@/lib/tutor/handlers";
import { memoryRepo, type Seed } from "./helpers/memoryRepo";

const child = { role: "child" as const, userId: "c1", familyId: "f1", grade: 9 as const, childCode: "HS-9A", displayName: "HS-9A" } as never;
const parent = { role: "parent" as const, userId: "a1", familyId: "f1" } as never;
const NOW = new Date("2026-11-22T09:00:00Z");
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const seed = (): Seed => ({
  problems: [{ id: "p1", childId: "c1" }, { id: "p2", childId: "c2" }],
  messages: [
    { id: U(11), problemId: "p1", role: "child", text: "đề", clientMsgId: U(1) },
    { id: U(12), problemId: "p1", role: "tutor", text: "Vậy x = 3 nhé" },
    { id: U(13), problemId: "p2", role: "tutor", text: "của em gái", childId: "c2" },
  ],
});
function deps(actor: unknown = child) {
  const repo = memoryRepo(seed());
  return { d: { repo, actor, now: NOW } as never, repo };
}

describe("flagMessage — 'Cô sai ở đây' (D32)", () => {
  it("a tutor message of the child's own problem, by id → saved with kind and comment", async () => {
    const { d, repo } = deps();
    const tutorId = repo.messages[1]!.id;
    const r = await flagMessage(d, { messageRef: tutorId, kind: "gave_answer", comment: "  cô nói luôn đáp số ", clientMsgId: U(9) });
    expect(r).toEqual({ status: 200, json: { status: "saved" } });
    expect(repo.feedback).toEqual([expect.objectContaining({ problemId: "p1", messageId: tutorId, kind: "gave_answer", comment: "cô nói luôn đáp số" })]);
  });
  it("the child's own message, a sibling's tutor message, a non-uuid → 404", async () => {
    const { d } = deps();
    for (const messageRef of [U(11), U(13), "m2"]) expect((await flagMessage(d, { messageRef, kind: "wrong", clientMsgId: U(9) })).status).toBe(404);
  });
  it("a reply that arrived in this page ('<clientMsgId>-reply') → the tutor message after it", async () => {
    const { d, repo } = deps();
    expect((await flagMessage(d, { messageRef: `${U(1)}-reply`, kind: "unclear", clientMsgId: U(9) })).status).toBe(200);
    expect(repo.feedback[0]?.messageId).toBe(repo.messages[1]!.id);
  });
  it("double tap → stored once", async () => {
    const { d, repo } = deps();
    const b = { messageRef: `${U(1)}-reply`, kind: "wrong", clientMsgId: U(9) };
    await flagMessage(d, b);
    expect((await flagMessage(d, b)).json).toEqual({ status: "already" });
    expect(repo.feedback).toHaveLength(1);
  });
  it("a sibling's message, the child's own message, an unknown reply → 404", async () => {
    const { d } = deps();
    expect((await flagMessage(d, { messageRef: `${U(7)}-reply`, kind: "wrong", clientMsgId: U(9) })).status).toBe(404);
  });
  it("a parent cannot flag; a bad kind or a 501-letter comment is refused", async () => {
    expect((await flagMessage(deps(parent).d, { messageRef: `${U(1)}-reply`, kind: "wrong", clientMsgId: U(9) })).status).toBe(401);
    const { d } = deps();
    expect((await flagMessage(d, { messageRef: `${U(1)}-reply`, kind: "bad", clientMsgId: U(9) })).status).toBe(400);
    expect((await flagMessage(d, { messageRef: `${U(1)}-reply`, kind: "other", comment: "x".repeat(501), clientMsgId: U(9) })).status).toBe(400);
  });
});

describe("rating comment (D32): 10 minutes to add reasons and a written comment", () => {
  it("face, then reasons + comment 8 minutes later → updated; after 10 minutes → already", async () => {
    const repo = memoryRepo({ sessions: [{ id: "s1" }] });
    const d = { repo, actor: child, now: NOW } as unknown as Deps;
    await rateSession(d, { sessionId: "s1", face: "hard" });
    const r = await rateSession({ ...d, now: new Date(NOW.getTime() + 8 * 60_000) },
      { sessionId: "s1", face: "hard", reasons: ["hard_words"], comment: "Cô dùng chữ 'nghiệm ngoại lai' em không hiểu" });
    expect(r.json).toEqual({ status: "updated" });
    expect(repo.ratings[0]).toMatchObject({ reasons: ["hard_words"], comment: "Cô dùng chữ 'nghiệm ngoại lai' em không hiểu" });
    expect((await rateSession({ ...d, now: new Date(NOW.getTime() + 11 * 60_000) }, { sessionId: "s1", face: "ok" })).json).toEqual({ status: "already" });
  });
});

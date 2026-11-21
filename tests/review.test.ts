// G6b: answering the start-of-session review (DOMAIN §4.11 a–f), server-graded, idempotent, this child only.
import { describe, expect, it } from "vitest";
import { answerReview, dueReviews, type ReviewDeps } from "@/lib/tutor/review";
import type { CasClient } from "@/lib/tools/casClient";
import { memoryRepo, type Seed } from "./helpers/memoryRepo";

const child = { role: "child" as const, userId: "c1", familyId: "f1", grade: 6 as const, childCode: "HS-6A",
  maxLines: 6, profileVersion: 1, profileText: "" };
const NOW = new Date("2026-11-21T10:00:00Z"); // 21/11 in Vietnam
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const item = (n: number, o: Record<string, unknown> = {}) => ({ id: uuid(n), prompt: `Câu ${n}?`, answer: "BCNN", dueDateVn: "2026-11-21", ...o });
function deps(seed: Seed, cas: CasClient | null = null, actor: ReviewDeps["actor"] = child) {
  const repo = memoryRepo(seed);
  return { d: { repo, actor, now: NOW, cas } satisfies ReviewDeps, repo };
}
const ask = (n: number, msg: number, answer?: string) => ({ itemId: uuid(n), clientMsgId: uuid(100 + msg), ...(answer ? { answer } : { skipped: true }) });

describe("answerReview", () => {
  it("a: box 1 right → box 2, due in 3 days; the answer comes back only after answering", async () => {
    const { d, repo } = deps({ reviewItems: [item(1)] });
    const r = await answerReview(d, ask(1, 1, " bcnn "));
    expect(r.json).toEqual({ result: "correct", answer: "BCNN", nextDueVn: "2026-11-24" });
    expect(repo.reviewItems[0]).toMatchObject({ box: 2, correctStreak: 1, dueDateVn: "2026-11-24" });
  });
  it("b: box 3 wrong → box 1, tomorrow, streak 0", async () => {
    const { d, repo } = deps({ reviewItems: [item(1, { box: 3, correctStreak: 2 })] });
    expect((await answerReview(d, ask(1, 1, "ƯCLN"))).json).toMatchObject({ result: "wrong", answer: "BCNN" });
    expect(repo.reviewItems[0]).toMatchObject({ box: 1, correctStreak: 0, dueDateVn: "2026-11-22" });
  });
  it("e: 'Để sau' keeps box and streak, due tomorrow; no answer shown", async () => {
    const { d, repo } = deps({ reviewItems: [item(1, { box: 2, correctStreak: 1 })] });
    expect((await answerReview(d, ask(1, 1))).json).toEqual({ result: "skipped", answer: null, nextDueVn: "2026-11-22" });
    expect(repo.reviewItems[0]).toMatchObject({ box: 2, correctStreak: 1 });
  });
  it("d: the third right answer in a row retires the question", async () => {
    const { d, repo } = deps({ reviewItems: [item(1, { box: 3, correctStreak: 2 })] });
    await answerReview(d, ask(1, 1, "BCNN"));
    expect(repo.reviewItems[0]!.status).toBe("retired");
  });
  it("the same press twice is graded once", async () => {
    const { d, repo } = deps({ reviewItems: [item(1)] });
    const a = await answerReview(d, ask(1, 1, "BCNN"));
    const b = await answerReview(d, ask(1, 1, "BCNN"));
    expect(b.json).toEqual(a.json);
    expect(repo.reviewItems[0]!.box).toBe(2);
    expect(repo.reviewAttempts).toHaveLength(1);
  });
  it("another child's question → 404; a parent → 401; a question not due yet → 409", async () => {
    expect((await answerReview(deps({ reviewItems: [item(1, { childId: "c2" })] }).d, ask(1, 1, "BCNN"))).status).toBe(404);
    expect((await answerReview(deps({ reviewItems: [item(1)] }, null, { role: "parent", userId: "p", familyId: "f1" }).d, ask(1, 1, "x"))).status).toBe(401);
    expect((await answerReview(deps({ reviewItems: [item(1, { dueDateVn: "2026-11-22" })] }).d, ask(1, 1, "BCNN"))).status).toBe(409);
  });
  it("math_check: cas says equivalent → correct; cas down → not graded, nothing changes", async () => {
    const yes: CasClient = { check: async () => ({ ok: true, result: { equivalent: true } }), health: async () => true };
    const mini = item(1, { kind: "mini_problem", answerCheck: "math_check", answer: "2*x" });
    expect((await answerReview(deps({ reviewItems: [mini] }, yes).d, ask(1, 1, "x+x"))).json).toMatchObject({ result: "correct" });
    const { d, repo } = deps({ reviewItems: [mini] }, null);
    expect((await answerReview(d, ask(1, 2, "x+x"))).json).toMatchObject({ result: "unchecked", message: "Cô kiểm lại sau nhé." });
    expect([repo.reviewItems[0]!.box, repo.reviewAttempts.length]).toEqual([1, 0]);
  });
});

describe("dueReviews", () => {
  it("f: 5 due → the 2 with the lowest box; never the answer", async () => {
    const { repo } = deps({ reviewItems: [item(1, { box: 3 }), item(2, { box: 1 }), item(3, { box: 2 }), item(4, { box: 1, dueDateVn: "2026-11-20" }),
      item(5, { box: 4 }), item(6, { box: 1, dueDateVn: "2026-11-25" })] });
    const due = await dueReviews(repo, "c1", NOW);
    expect(due.map((x) => x.id)).toEqual([uuid(4), uuid(2)]);
    expect(JSON.stringify(due)).not.toContain("BCNN");
  });
});

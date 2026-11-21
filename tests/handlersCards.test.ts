// G6a: the server shows approved cards (DOMAIN §4.15) and answers two buttons without the model (Y3).
import { describe, expect, it } from "vitest";
import { handleTurn, type Deps } from "@/lib/tutor/handlers";
import type { ModelClient } from "@/lib/tutor/turn";
import { BTN_CARD_AGAIN, BTN_NOT_UNDERSTAND_PROBLEM, CARD_AGAIN_INTRO, CARDS_DONE, DOC_DE_ASK } from "@/lib/copy";
import { memoryRepo, type Seed } from "./helpers/memoryRepo";
import fewshot from "./fixtures/fewshot.json";

const grade6 = { role: "child" as const, userId: "c1", familyId: "f1", grade: 6 as const, childCode: "HS-6A",
  maxLines: 6, profileVersion: 1, profileText: "HỒ SƠ HS-6A" };
const NOW = new Date("2026-11-21T10:05:00Z");
const PASS = JSON.stringify({ pass: true, ly_do: [] });
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

describe("the tutor names a card, the server shows it (§4.15)", () => {
  it("way 1 when its example does not use the child's numbers; fixed buttons; H2 at least (Y1)", async () => {
    const { d, repo } = deps(seed(SHIPS), out({ the_hien: "T6.12", message: "Cô giảng em phần này nhé:", buttons: ["Ước chung"] }));
    const r = await handleTurn(d, turn(1, "BCNN là gì ạ"));
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ cardRef: "T6.12#1", buttons: ["Em hiểu rồi", "Giảng lại cách khác"], message: "Cô giảng em phần này nhé:" });
    expect(repo.problems[0]!.hintLevelMax).toBeGreaterThanOrEqual(2);
    expect(repo.messages.at(-1)!.cardRef).toBe("T6.12#1");
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

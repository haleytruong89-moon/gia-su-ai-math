import { describe, expect, it } from "vitest";
import { activeRules, canApprove, nextVersion, ratingProposal, rulesBlock, rulesVersionNow, type RuleRow } from "@/lib/rules/teachingRules";

const r = (o: Partial<RuleRow>): RuleRow => ({ id: "r", status: "approved", version: 1, text: "Luật", sourceKey: null, ...o });

describe("rule versions (§3.4: a session uses the rules of its start)", () => {
  const rules = [r({ id: "a", version: 1 }), r({ id: "b", version: 2, status: "superseded" }), r({ id: "c", version: 3 }), r({ id: "d", version: 0, status: "proposed" })];
  it("rulesVersionNow = highest approved", () => expect(rulesVersionNow(rules)).toBe(3));
  it("no rules → 0", () => expect(rulesVersionNow([])).toBe(0));
  it("nextVersion = highest ever + 1", () => expect(nextVersion(rules)).toBe(4));
  it("nextVersion of nothing = 1", () => expect(nextVersion([])).toBe(1));
  it("a session pinned at 1 does not see the rule approved later (version 3)", () =>
    expect(activeRules(rules, 1).map((x) => x.id)).toEqual(["a"]));
  it("superseded and proposed rules are never active", () => expect(activeRules(rules, 9).map((x) => x.id)).toEqual(["a", "c"]));
});

describe("rulesBlock", () => {
  it("empty → empty string", () => expect(rulesBlock([])).toBe(""));
  it("lists the rules under a header that keeps rules 1–12 first", () =>
    expect(rulesBlock([r({ text: "Mỗi lượt chỉ hỏi con một câu." })])).toBe(
      "[LUẬT BỐ MẸ ĐÃ DUYỆT — áp dụng trong khuôn khổ luật 1–12, không bao giờ được trái các luật đó]\n- Mỗi lượt chỉ hỏi con một câu."));
});

describe("ratingProposal (P3, X4)", () => {
  const hard = (reasons: string[]) => ({ face: "hard", reasons });
  it("😕 twice with the same reason → proposal", () =>
    expect(ratingProposal([hard(["too_long"]), hard(["too_long", "hard_words"])], [])).toEqual({ sourceKey: "rating:too_long", text: "Trả lời ngắn hơn: mỗi lượt một ý, tối đa 3 dòng." }));
  it("different reasons → none", () => expect(ratingProposal([hard(["too_long"]), hard(["hard_words"])], [])).toBeNull());
  it("one of the two is not 😕 → none", () => expect(ratingProposal([hard(["too_long"]), { face: "ok", reasons: ["too_long"] }], [])).toBeNull());
  it("only one rating → none", () => expect(ratingProposal([hard(["too_long"])], [])).toBeNull());
  it("positive reasons never make a rule", () => expect(ratingProposal([hard(["clear"]), hard(["clear"])], [])).toBeNull());
  it("already proposed or approved for that reason → none; rejected or retired → may propose again", () => {
    const two = [hard(["too_long"]), hard(["too_long"])];
    expect(ratingProposal(two, [r({ status: "proposed", sourceKey: "rating:too_long" })])).toBeNull();
    expect(ratingProposal(two, [r({ status: "approved", sourceKey: "rating:too_long" })])).toBeNull();
    expect(ratingProposal(two, [r({ status: "rejected", sourceKey: "rating:too_long" })])).not.toBeNull();
    expect(ratingProposal(two, [r({ status: "superseded", sourceKey: "rating:too_long" })])).not.toBeNull();
  });
  it("each negative reason has its sentence", () => {
    expect(ratingProposal([hard(["hard_words"]), hard(["hard_words"])], [])?.text).toBe("Dùng từ dễ hiểu; gặp từ toán học mới thì giải thích bằng một câu ngắn.");
    expect(ratingProposal([hard(["answer_too_early"]), hard(["answer_too_early"])], [])?.text).toBe("Không nói trước bước tiếp theo; để con thử trước rồi mới gợi ý.");
    expect(ratingProposal([hard(["too_many_questions"]), hard(["too_many_questions"])], [])?.text).toBe("Mỗi lượt chỉ hỏi con một câu.");
  });
});

describe("canApprove (X3)", () => {
  const n = (k: number) => Array.from({ length: k }, (_, i) => r({ id: `${i}`, version: i + 1 }));
  it("12 active → no more", () => expect(canApprove(n(12))).toBe(false));
  it("11 active → yes", () => expect(canApprove(n(11))).toBe(true));
});

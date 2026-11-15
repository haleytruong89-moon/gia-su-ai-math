import { describe, expect, it } from "vitest";
import { childEvents, type StoredMsg } from "@/lib/rules/events";
import { isNanSignal } from "@/lib/rules/nan";

let n = 0;
const t = (content: string): StoredMsg => ({ id: `t${++n}`, role: "tutor", content, inputKind: "text" });
const c = (content: string, inputKind: StoredMsg["inputKind"] = "text"): StoredMsg => ({ id: `c${++n}`, role: "child", content, inputKind });

describe("childEvents → isNanSignal (DOMAIN §4.2)", () => {
  it("4.1c: 'k' then 'ko biết' typed → nản", () => {
    expect(isNanSignal(childEvents([t("Đề hỏi gì?"), c("k"), t("Thử lại nhé?"), c("ko biết")]))).toBe(true);
  });
  it("4.2a: 'ok' then 'x=6' → not nản", () => {
    expect(isNanSignal(childEvents([t("?"), c("ok"), t("?"), c("x=6")]))).toBe(false);
  });
  it("4.2e: 'k', button 'Hiểu rồi', 'k' → not nản (a button breaks the run)", () => {
    expect(isNanSignal(childEvents([t("?"), c("k"), t("?"), c("Hiểu rồi", "button"), t("?"), c("k")]))).toBe(false);
  });
  it("'Chưa hiểu' 3 times on the same explanation chain → nản (all 3 presses share one root)", () => {
    const m = [t("Giảng A"), c("Chưa hiểu", "button"), t("Giảng lại A"), c("Chưa hiểu", "button"), t("Giảng lại A lần 2"), c("Chưa hiểu", "button")];
    const ev = childEvents(m);
    const roots = ev.flatMap((e) => (e.kind === "button" ? [e.replyTo] : []));
    expect(roots).toHaveLength(3);
    expect(new Set(roots).size).toBe(1);
    expect(roots[0]).toBe(m[0]!.id);
    expect(isNanSignal(ev)).toBe(true);
  });
  it("4.2c: 'Chưa hiểu' twice at two different places → not nản", () => {
    const m = [t("Giảng A"), c("Chưa hiểu", "button"), t("Giảng lại A"), c("x = 2"), t("Giảng B"), c("Chưa hiểu", "button")];
    expect(isNanSignal(childEvents(m))).toBe(false);
  });
  it("a 'nộp bài' message counts as typed content", () => {
    expect(childEvents([t("?"), c("x = 24, y = 48", "submit")])).toEqual([{ kind: "text", text: "x = 24, y = 48" }]);
  });
});

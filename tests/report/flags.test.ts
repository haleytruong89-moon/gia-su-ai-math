import { describe, expect, it } from "vitest";
import { costFlag, dayFlags, isBlockedSlot, type DayFacts, type ProblemFacts } from "@/lib/report/flags";

const p = (o: Partial<ProblemFacts>): ProblemFacts => ({
  id: "p", status: "self_solved", hintLevelMax: 1, nanJumps: 0, uLevel: 3, kuCode: null, examSlot: null,
  prereqGaps: [], geometryProof: false, rewrittenCount: 0, referenceMismatch: false, ...o,
});
const day = (problems: ProblemFacts[], o: Partial<DayFacts> = {}): DayFacts =>
  ({ problems, sessionsAbandoned: 0, ratingsHard: 0, casErrors: 0, ...o });
const title = (c: string) => ({ "N8.10": "tam giác đồng dạng" } as Record<string, string>)[c] ?? null;
const kinds = (d: DayFacts) => dayFlags(d, title).map((f) => f.kind);

describe("dayFlags (DOMAIN §4.7)", () => {
  it("quiet day: no flag", () => expect(kinds(day([p({})]))).toEqual([]));
  it("H4 in 2 problems → gợi ý nhiều, with the nản jumps counted apart", () => {
    const f = dayFlags(day([p({ id: "a", hintLevelMax: 4, nanJumps: 1 }), p({ id: "b", hintLevelMax: 5 })]), title);
    expect(f.find((x) => x.kind === "goi_y_nhieu")).toEqual({ kind: "goi_y_nhieu", text: "Gợi ý nhiều: 2 bài lên H4 (1 lần do nản)", problemIds: ["a", "b"] });
  });
  it("H4 in only 1 problem → no gợi ý nhiều", () => expect(kinds(day([p({ hintLevelMax: 4 })]))).not.toContain("goi_y_nhieu"));
  it("pending_review → chờ thầy xem", () => expect(kinds(day([p({ status: "pending_review" })]))).toContain("cho_thay"));
  it("abandoned problem, abandoned session or a nản jump → nản / bỏ dở", () => {
    expect(kinds(day([p({ status: "abandoned" })]))).toContain("nan_bo_do");
    expect(kinds(day([p({})], { sessionsAbandoned: 1 }))).toContain("nan_bo_do");
    expect(kinds(day([p({ nanJumps: 1, hintLevelMax: 4 })]))).toContain("nan_bo_do");
  });
  it("nản / bỏ dở text lists what happened", () => {
    const f = dayFlags(day([p({ id: "a", status: "abandoned" }), p({ id: "b", nanJumps: 2 })], { sessionsAbandoned: 1 }), title);
    expect(f.find((x) => x.kind === "nan_bo_do")).toEqual({ kind: "nan_bo_do", text: "Nản / bỏ dở: 1 bài bỏ dở, 1 buổi bỏ dở, nản 2 lần", problemIds: ["a", "b"] });
  });
  it("a hard rating → con chấm khó hiểu", () => expect(kinds(day([], { ratingsHard: 1 }))).toEqual(["con_cham_kho"]));
  it("geometry proof → bài hình", () => expect(kinds(day([p({ geometryProof: true, status: "pending_review" })]))).toContain("bai_hinh"));
  it("rewritten ≥ 2 in ONE problem → viết lại nhiều; 1 + 1 in two problems → no", () => {
    expect(kinds(day([p({ rewrittenCount: 2 })]))).toContain("viet_lai_nhieu");
    expect(kinds(day([p({ id: "a", rewrittenCount: 1 }), p({ id: "b", rewrittenCount: 1 })]))).not.toContain("viet_lai_nhieu");
  });
  it("background gaps: code + title, each once", () => {
    const f = dayFlags(day([p({ prereqGaps: ["N8.10"] }), p({ prereqGaps: ["N8.10", "N7.02"] })]), title);
    expect(f.find((x) => x.kind === "lo_hong_nen")?.text).toBe("Lỗ hổng nền: N8.10 — tam giác đồng dạng; N7.02");
  });
  it("blocked exam item stopped at U0–U1 → ý chặn; at U2 or a non-blocked item → no", () => {
    expect(dayFlags(day([p({ examSlot: "HN10-4c", uLevel: 1, status: "saved_for_later" })]), title)[0])
      .toEqual({ kind: "y_chan", text: "Ý chặn dừng ở U0–U1: HN10-4c (U1)", problemIds: ["p"] });
    expect(kinds(day([p({ examSlot: "HN10-4c", uLevel: 2 })]))).not.toContain("y_chan");
    expect(kinds(day([p({ examSlot: "HN10-1a", uLevel: 0 })]))).not.toContain("y_chan");
  });
  it("cas errors ≥ 2 → máy tính lỗi; 1 → no", () => {
    expect(dayFlags(day([], { casErrors: 2 }), title)).toEqual([{ kind: "cas_loi", text: "Máy tính đại số lỗi 2 lần", problemIds: [] }]);
    expect(kinds(day([], { casErrors: 1 }))).toEqual([]);
  });
  it("G7c: a reference solution cas did not confirm → flag for the parents (X5)", () => {
    expect(dayFlags(day([p({ id: "a", referenceMismatch: true })]), title)).toEqual([{ kind: "loi_giai_lech", text: "Lời giải tham khảo lệch đáp số đã kiểm ở 1 bài (không hiện cho con)", problemIds: ["a"] }]);
  });
  it("G8-fix: safe lines shown → flag with the count and the commonest checker reason", () => {
    const f = dayFlags(day([
      p({ id: "a", safeLineCount: 3, blockReasons: ["6: khẳng định hình đúng mà không có math_check", "6: khẳng định hình đúng mà không có math_check", "3: không kết thúc bằng câu hỏi"] }),
      p({ id: "b", safeLineCount: 1, blockReasons: ["guard_unavailable"] }),
      p({ id: "c", safeLineCount: 0 }),
    ]), title);
    expect(f).toEqual([{ kind: "cau_soan_san", problemIds: ["a", "b"],
      text: "Cô phải dùng câu soạn sẵn 4 lượt ở 2 bài — hay bị chặn vì: 6: khẳng định hình đúng mà không có math_check" }]);
    expect(dayFlags(day([p({ id: "d", safeLineCount: 1, blockReasons: ["guard_unavailable"] })]), title)[0]?.text).toBe("Cô phải dùng câu soạn sẵn 1 lượt ở 1 bài");
  });
  it("flags come in the parents' priority order (X1)", () => {
    expect(kinds(day([
      p({ id: "a", hintLevelMax: 4, rewrittenCount: 2, geometryProof: true, status: "pending_review", prereqGaps: ["N8.10"], safeLineCount: 1 }),
      p({ id: "b", hintLevelMax: 4, examSlot: "HN10-2c", uLevel: 0, status: "abandoned" }),
    ], { ratingsHard: 1, casErrors: 3 }))).toEqual(["cas_loi", "y_chan", "nan_bo_do", "con_cham_kho", "goi_y_nhieu", "cho_thay", "lo_hong_nen", "bai_hinh", "cau_soan_san", "viet_lai_nhieu"]);
  });
});

describe("isBlockedSlot (ý chặn: 2c, 3c, 4b ý 2, 4c, 5)", () => {
  it.each([["HN10-2c", true], ["HN10-3c", true], ["HN10-4b-y2", true], ["HN10-4c", true], ["HN10-5", true], ["HN10-5b", true],
    ["HN10-4b-y1", false], ["HN10-4b", false], ["HN10-2a", false], [null, false]] as const)("%s → %s", (s, v) => expect(isBlockedSlot(s)).toBe(v));
});

describe("costFlag (§4.5 a, D29)", () => {
  it("≤ 40 USD normal → none", () => expect(costFlag({ costUsd: 40, mode: "normal" })).toBeNull());
  it("> 40 USD → shown", () => expect(costFlag({ costUsd: 41.2, mode: "normal" })).toBe("Chi phí tháng: 41,2 / 50 USD (> 80%)"));
  it("economy → says Opus is paused", () => expect(costFlag({ costUsd: 45.1, mode: "economy" })).toBe("Chi phí tháng: 45,1 / 50 USD · đang tạm ngừng Opus"));
  it("whole numbers drop the decimal", () => expect(costFlag({ costUsd: 46, mode: "economy" })).toBe("Chi phí tháng: 46 / 50 USD · đang tạm ngừng Opus"));
});

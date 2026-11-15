import { describe, expect, it } from "vitest";
import { checkOutput, mentions, messageLines } from "@/eval/checks";
import type { TutorOutput } from "@/lib/tutor/schema";

const out = (o: Partial<TutorOutput> = {}): TutorOutput => ({
  message: "Em thử gọi thời gian người I làm một mình là x giờ nhé?", buttons: ["Em gọi được rồi"], de_da_xac_nhan: true,
  ku_code_de_xuat: null, goc_loi_du_doan: null, goc_loi_da_kiem_tra: false, prereq_gap: null, danh_gia_luot_em: "khong_ap_dung",
  u_level_hien_tai: "U0", ky_thuat: "thuong", checklist_da_hoi: [], ket_qua_bai: "in_progress", flags: [], ...o,
});

describe("mentions (answer leak by number)", () => {
  it("finds a whole number, not a part of another", () => {
    expect(mentions("Người I làm 24 giờ", "24")).toBe(true);
    expect(mentions("Hết 240 phút, 1/24 công việc", "24")).toBe(true); // 1/24 still shows 24
    expect(mentions("Đổi 2,4 giờ", "24")).toBe(false);
    expect(mentions("lúc 124 giờ", "24")).toBe(false);
  });
  it("matches a fraction or an expression as typed, with flexible spaces", () => {
    expect(mentions("vậy x ≤ 4/5", "x ≤ 4/5")).toBe(true);
    expect(mentions("vậy x≤4/5", "x ≤ 4/5")).toBe(true);
  });
});

describe("messageLines", () => {
  it("counts non-empty lines", () => expect(messageLines("a\n\nb\n c ")).toBe(3));
});

describe("checkOutput", () => {
  it("passes a clean turn", () => {
    expect(checkOutput(out(), { maxLines: 6, forbid: ["24", "48"] }).failures).toEqual([]);
  });
  it("flags a leak, too many lines, a missing flag and a premature self_solved", () => {
    const r = checkOutput(out({ message: "1\n2\n3\n4\n5\n6\nNgười I làm 24 giờ.", ket_qua_bai: "self_solved" }),
      { maxLines: 6, forbid: ["24"], expect: { flags: ["geometry_proof"], notSelfSolved: true } });
    expect(r.failures).toEqual(["leak:24", "lines:7>6", "flag_missing:geometry_proof", "self_solved_too_early"]);
    expect(r.leak).toBe(true);
  });
  it("checks buttons and the verdict on the child's turn", () => {
    const r = checkOutput(out({ buttons: [], danh_gia_luot_em: "dung" }),
      { maxLines: 4, expect: { minButtons: 1, verdictIn: ["sai"], buttonMatches: /đồng dạng/i } });
    expect(r.failures).toEqual(["buttons:0<1", "verdict:dung", "button_missing:/đồng dạng/i"]);
  });
  it("an unreadable reply fails as format", () => {
    expect(checkOutput(null, { maxLines: 6 }).failures).toEqual(["format"]);
  });
});

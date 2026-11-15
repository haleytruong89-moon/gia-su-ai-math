// tests/assemble.test.ts
import { describe, expect, it } from "vitest";
import { assemble, renderStateBlock } from "@/lib/tutor/assemble";

const state = { grade: 9 as const, hintLevel: 2, wrongCount: 2, nan: false, idle: false, submitted: false,
  mode: "thuong" as const, minutesLeft: 18, turn: 7, stuckKind: "khong_biet_bat_dau", kuCode: "T9.9", examSlot: "HN10-2c", maxLines: 6 };

describe("assemble", () => {
  it("state block matches SYSTEM_PROMPT_v0.3 §⑥ (+ max_lines, G2)", () => {
    expect(renderStateBlock(state)).toBe(
      "[TRẠNG THÁI — do app tính, cô làm theo]\n" +
      "lop: 9 | muc_goi_y: H2 | so_lan_sai: 2 | nan: false | im_lau: false\n" +
      "da_nop_loi_giai: false | che_do: thuong | max_lines: 6\n" +
      "thoi_gian_buoi_con_lai: 18 phút | luot_trong_bai: 7/20\n" +
      "cho_ket_cua_em: khong_biet_bat_dau | ku_code: T9.9 | exam_slot: HN10-2c");
  });
  it("puts cache breakpoints on the fixed layers and the profile, not on the turn", () => {
    const out = assemble({ layers: { role: "①", rules: "②", method: "③" }, profileText: "④",
      knowledgeCard: "⑤", history: [], childText: "em không biết", state });
    expect(out.system.map((b) => Boolean(b.cache_control))).toEqual([false, false, true, true, true]);
    expect(out.messages.at(-1)?.content).toContain("em không biết");
    expect(out.messages.at(-1)?.content).toContain("[TRẠNG THÁI");
  });
  it("never contains a display name (only what the caller passes)", () => {
    const out = assemble({ layers: { role: "①", rules: "②", method: "③" }, profileText: "mã: HS-9A",
      knowledgeCard: null, history: [], childText: "x", state });
    expect(JSON.stringify(out)).not.toMatch(/display_name/);
  });
  it("⑥ carries max_lines from the teaching profile", () => {
    expect(renderStateBlock({ ...state, maxLines: 4 })).toContain("max_lines: 4");
  });
});

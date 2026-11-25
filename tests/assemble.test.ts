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
  it("⑥ says whether the statement is already confirmed (G8-fix), only when the caller knows", () => {
    expect(renderStateBlock({ ...state, statementConfirmed: true })).toContain("luot_trong_bai: 7/20 | de_da_xac_nhan: true");
    expect(renderStateBlock({ ...state, statementConfirmed: false })).toContain("de_da_xac_nhan: false");
    expect(renderStateBlock(state)).not.toContain("de_da_xac_nhan");
  });
  it("⑥ says when the math checker is down (G8-fix2), and nothing when it works", () => {
    expect(renderStateBlock({ ...state, statementConfirmed: true, casDown: true })).toContain("de_da_xac_nhan: true | may_tinh: loi");
    expect(renderStateBlock({ ...state, casDown: false })).not.toContain("may_tinh");
  });
  it("⑥ carries max_lines from the teaching profile", () => {
    expect(renderStateBlock({ ...state, maxLines: 4 })).toContain("max_lines: 4");
  });
  const img = { mediaType: "image/jpeg" as const, data: "QUJD" };
  it("photos go before the text of the same child message; the newest photo is the 4th cache breakpoint", () => {
    const out = assemble({ layers: { role: "①", rules: "②", method: "③" }, profileText: "④", knowledgeCard: null,
      history: [{ role: "user", content: "📷 Em gửi ảnh", images: [img] }, { role: "assistant", content: "Cô đọc đề là…" }],
      childText: "Đây là bài làm", childImages: [img], state });
    const first = out.messages[0]!.content as { type: string; cache_control?: unknown }[];
    expect(first.map((b) => b.type)).toEqual(["image", "text"]);
    expect(first[0]!.cache_control).toBeUndefined();
    const last = out.messages.at(-1)!.content as { type: string; text?: string; cache_control?: unknown }[];
    expect(last.map((b) => b.type)).toEqual(["image", "text"]);
    expect(last[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect(last[1]!.text).toContain("[EM]\nĐây là bài làm");
    expect(JSON.stringify(out).match(/"ephemeral"/g)).toHaveLength(4); // the API allows 4
  });
  it("G6: the card index rides in the cached method block (one cache per grade)", () => {
    const out = assemble({ layers: { role: "①", rules: "②", method: "③" }, profileText: "④", knowledgeCard: null,
      cardIndex: "[MỤC LỤC THẺ]", history: [], childText: "x", state });
    expect(out.system[2]!.text).toBe("③\n\n[MỤC LỤC THẺ]");
    expect(out.system[2]!.cache_control).toBeTruthy();
  });
  it("text-only turns keep string content (and 3 breakpoints)", () => {
    const out = assemble({ layers: { role: "①", rules: "②", method: "③" }, profileText: "④", knowledgeCard: null,
      history: [{ role: "user", content: "đề" }], childText: "x", state });
    expect(typeof out.messages[0]!.content).toBe("string");
    expect(JSON.stringify(out).match(/"ephemeral"/g)).toHaveLength(3);
  });
});

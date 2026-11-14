// lib/tutor/assemble.ts
export type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
export type Msg = { role: "user" | "assistant"; content: string };
export interface TurnStateBlock { grade: 6 | 9; hintLevel: number; wrongCount: number; nan: boolean; idle: boolean;
  submitted: boolean; mode: "thuong" | "tiet_kiem"; minutesLeft: number; turn: number; stuckKind: string | null;
  kuCode: string | null; examSlot: string | null }

export function renderStateBlock(s: TurnStateBlock): string {
  return [
    "[TRẠNG THÁI — do app tính, cô làm theo]",
    `lop: ${s.grade} | muc_goi_y: H${s.hintLevel} | so_lan_sai: ${s.wrongCount} | nan: ${s.nan} | im_lau: ${s.idle}`,
    `da_nop_loi_giai: ${s.submitted} | che_do: ${s.mode}`,
    `thoi_gian_buoi_con_lai: ${s.minutesLeft} phút | luot_trong_bai: ${s.turn}/20`,
    `cho_ket_cua_em: ${s.stuckKind ?? "khong_ro"} | ku_code: ${s.kuCode ?? "chua_ro"} | exam_slot: ${s.examSlot ?? "khong"}`,
  ].join("\n");
}

export function assemble(input: {
  layers: { role: string; rules: string; method: string }; profileText: string; knowledgeCard: string | null;
  history: Msg[]; childText: string; state: TurnStateBlock;
}): { system: SystemBlock[]; messages: Msg[] } {
  const cache = { type: "ephemeral" as const };
  const system: SystemBlock[] = [
    { type: "text", text: input.layers.role },
    { type: "text", text: input.layers.rules },
    { type: "text", text: input.layers.method, cache_control: cache },       // ①②③ cached together
    { type: "text", text: input.profileText, cache_control: cache },          // ④ per child
    { type: "text", text: input.knowledgeCard ?? "[KIẾN THỨC — chưa xác định]", cache_control: cache }, // ⑤ per problem
  ];
  const messages: Msg[] = [...input.history,
    { role: "user", content: `${renderStateBlock(input.state)}\n\n[EM]\n${input.childText}` }];
  return { system, messages };
}

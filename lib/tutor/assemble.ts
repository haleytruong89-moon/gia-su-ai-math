// lib/tutor/assemble.ts
export type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
export type ImageData = { mediaType: "image/jpeg"; data: string }; // base64
export type ContentBlock =
  | { type: "text"; text: string; cache_control?: { type: "ephemeral" } }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string }; cache_control?: { type: "ephemeral" } }
  // tool rounds (G4): the model's thinking + tool_use blocks go back as they came; tool_result answers them
  | { type: "thinking" | "redacted_thinking" | "tool_use" | "tool_result"; cache_control?: never; [k: string]: unknown };
/** What goes to the API. Messages without photos keep plain string content. */
export type Msg = { role: "user" | "assistant"; content: string | ContentBlock[] };
/** A history entry before it is sent: its photos go first in the same message, then the text. */
export type Turn = { role: "user" | "assistant"; content: string; images?: ImageData[] };

export const imageBlocks = (images: readonly ImageData[]): ContentBlock[] =>
  images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mediaType, data: i.data } }));

const toMsg = (t: Turn): Msg =>
  t.images?.length ? { role: t.role, content: [...imageBlocks(t.images), { type: "text", text: t.content }] } : { role: t.role, content: t.content };
export interface TurnStateBlock { grade: 6 | 9; hintLevel: number; wrongCount: number; nan: boolean; idle: boolean;
  submitted: boolean; mode: "thuong" | "tiet_kiem"; minutesLeft: number; turn: number; stuckKind: string | null;
  kuCode: string | null; examSlot: string | null; maxLines: number;
  /** G5: answers in a row that taught background knowledge (§4.13, at most 2). */
  bridgeTurns?: number;
  /** G8-fix: the child already confirmed the statement — the tutor must not restate it or ask "đúng chưa?" again. */
  statementConfirmed?: boolean;
  /**
   * G8-fix2 / D36: how much math_check can do this turn. "loi" = nothing (the tools are not offered);
   * "chi_so" = no algebra service, only the in-app number checker (values, ƯCLN/BCNN, numbers put into equations).
   */
  casMode?: "loi" | "chi_so" | null }

export function renderStateBlock(s: TurnStateBlock): string {
  return [
    "[TRẠNG THÁI — do app tính, cô làm theo]",
    `lop: ${s.grade} | muc_goi_y: H${s.hintLevel} | so_lan_sai: ${s.wrongCount} | nan: ${s.nan} | im_lau: ${s.idle}`,
    `da_nop_loi_giai: ${s.submitted} | che_do: ${s.mode} | max_lines: ${s.maxLines}`,
    `thoi_gian_buoi_con_lai: ${s.minutesLeft} phút | luot_trong_bai: ${s.turn}/20${s.statementConfirmed === undefined ? "" : ` | de_da_xac_nhan: ${s.statementConfirmed}`}${s.casMode ? ` | may_tinh: ${s.casMode}` : ""}`,
    `cho_ket_cua_em: ${s.stuckKind ?? "khong_ro"} | ku_code: ${s.kuCode ?? "chua_ro"} | exam_slot: ${s.examSlot ?? "khong"}`,
    ...(s.bridgeTurns ? [`day_bu_nen: ${Math.min(s.bridgeTurns, 2)}/2${s.bridgeTurns >= 2 ? " — đã đủ, quay lại bài gốc" : ""}`] : []),
  ].join("\n");
}

export function assemble(input: {
  layers: { role: string; rules: string; method: string }; profileText: string; knowledgeCard: string | null;
  /** G6: MỤC LỤC THẺ of the child's grade, appended to ③ (same cache block; one cache per grade). */
  cardIndex?: string;
  history: Turn[]; childText: string; childImages?: ImageData[]; state: TurnStateBlock;
}): { system: SystemBlock[]; messages: Msg[] } {
  const cache = { type: "ephemeral" as const };
  const system: SystemBlock[] = [
    { type: "text", text: input.layers.role },
    { type: "text", text: input.layers.rules },
    { type: "text", text: input.cardIndex ? `${input.layers.method}\n\n${input.cardIndex}` : input.layers.method, cache_control: cache }, // ①②③ cached together
    { type: "text", text: input.profileText, cache_control: cache },          // ④ per child
    { type: "text", text: input.knowledgeCard ?? "[KIẾN THỨC — chưa xác định]", cache_control: cache }, // ⑤ per problem
  ];
  const messages: Msg[] = [...input.history,
    { role: "user" as const, content: `${renderStateBlock(input.state)}\n\n[EM]\n${input.childText}`, images: input.childImages }].map(toMsg);
  // 4th (last allowed) cache breakpoint: the newest photo, so later turns read every photo from the cache.
  for (let i = messages.length - 1; i >= 0; i--) {
    const c = messages[i]!.content;
    const photo = Array.isArray(c) ? c.filter((b) => b.type === "image").at(-1) : undefined;
    if (photo) {
      photo.cache_control = cache;
      break;
    }
  }
  return { system, messages };
}

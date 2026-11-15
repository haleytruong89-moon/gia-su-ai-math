// lib/tutor/assemble.ts
export type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
export type ImageData = { mediaType: "image/jpeg"; data: string }; // base64
export type ContentBlock =
  | { type: "text"; text: string; cache_control?: { type: "ephemeral" } }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string }; cache_control?: { type: "ephemeral" } };
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
  kuCode: string | null; examSlot: string | null; maxLines: number }

export function renderStateBlock(s: TurnStateBlock): string {
  return [
    "[TRẠNG THÁI — do app tính, cô làm theo]",
    `lop: ${s.grade} | muc_goi_y: H${s.hintLevel} | so_lan_sai: ${s.wrongCount} | nan: ${s.nan} | im_lau: ${s.idle}`,
    `da_nop_loi_giai: ${s.submitted} | che_do: ${s.mode} | max_lines: ${s.maxLines}`,
    `thoi_gian_buoi_con_lai: ${s.minutesLeft} phút | luot_trong_bai: ${s.turn}/20`,
    `cho_ket_cua_em: ${s.stuckKind ?? "khong_ro"} | ku_code: ${s.kuCode ?? "chua_ro"} | exam_slot: ${s.examSlot ?? "khong"}`,
  ].join("\n");
}

export function assemble(input: {
  layers: { role: string; rules: string; method: string }; profileText: string; knowledgeCard: string | null;
  history: Turn[]; childText: string; childImages?: ImageData[]; state: TurnStateBlock;
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

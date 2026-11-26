// lib/knowledge/cardCodes.ts — card code patterns, shared by the server and the screens (client-safe: no zod).
// T/N/TH = hiểu bản chất (ban_chat), D = đọc đề (doc_de), C = cách làm (cach_lam, D37).
const PREFIX = "T6|T9|N7|N8|TH|D6|D9|C6|C9";
export const CARD_CODE = new RegExp(`^(?:${PREFIX})\\.[0-9]{1,2}$`);
export const CARD_REF = new RegExp(`^((?:${PREFIX})\\.[0-9]{1,2})#([12])$`);
/** Which kind a code must have: the letter says what the card teaches. */
export const kindOfCode = (code: string): "ban_chat" | "doc_de" | "cach_lam" =>
  code.startsWith("D") ? "doc_de" : code.startsWith("C") ? "cach_lam" : "ban_chat";

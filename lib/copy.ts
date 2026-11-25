// lib/copy.ts — fixed Vietnamese lines the app (not the model) says.
import { NOT_UNDERSTOOD } from "@/lib/rules/nan";
/** The model answered but not in the agreed shape: never show raw model text to the child. */
export const SAFE_REPLY = "Cô chưa nghĩ ra cách nói cho rõ. Em gửi lại câu vừa rồi giúp cô nhé.";
/** The model could not be reached (after one retry). */
export const SAFE_BUSY = "Cô đang bận một chút, em gửi lại sau ít phút nhé.";
/** §4.5 d: the API refused because the monthly spend limit was reached (Console). */
export const SPEND_PAUSED = "Gia sư AI tạm nghỉ, em ghi bài vào để dành nhé.";

export const STUCK_LABELS = {
  chua_hieu_de: "Chưa hiểu đề",
  khong_biet_bat_dau: "Không biết bắt đầu",
  lam_do_thi_tac: "Làm dở thì tắc",
  ra_ket_qua_sai: "Ra kết quả sai",
  khong_hieu_buoc: "Không hiểu bước…",
} as const;

export const BACK_TO_LAUNCHER = { href: "/today?tab=hoc-tap", label: "← Về Góc học tập" } as const;

/** App-provided buttons, always under the tutor's own buttons. */
export const BTN_NOT_UNDERSTOOD = NOT_UNDERSTOOD; // the nản rule counts this exact label
export const BTN_SAVE = "Để dành hỏi thầy";

/** Pre-written lines when the checker blocked an answer twice (DOMAIN §5). They never reveal anything. */
const SAFE_BY_LEVEL: Record<0 | 1 | 2 | 3 | 4 | 5, string> = {
  0: "Mình đọc lại đề cùng nhau nhé: đề cho em biết gì, và hỏi gì?",
  1: "Mình đọc lại đề cùng nhau nhé: đề cho em biết gì, và hỏi gì?",
  2: "Em viết ra bước đầu tiên em định làm, cô xem cùng em nhé?",
  3: "Mình làm một bước thật nhỏ: em chép lại dữ kiện đầu tiên của đề nhé?",
  4: "Em nghỉ tay một chút nhé. Xong em thử lại bước vừa rồi, hay mình để dành bài này hỏi thầy?",
  5: "Em đã cố gắng nhiều rồi. Mình để dành bài này hỏi thầy nhé?",
};

/** G8-fix (24/11): the safe line right after another safe line — never the same sentence twice in a row. */
export const SAFE_AGAIN = "Cô chưa nói được ý mới ở chỗ này. Em gõ bước em đang làm (hoặc bấm 📷 Gửi ảnh) cho cô xem, hay để dành bài này hỏi thầy?";
/** G8-fix: a third safe line in a row — stop pushing and offer the teacher. */
export const SAFE_STOP = "Hôm nay cô chưa giúp tốt được bài này. Mình để dành bài hỏi thầy, em làm bài khác trước nhé?";
/** G8-fix2 (D35): the first safe line once the statement is confirmed — never "read the problem again" then. */
export const SAFE_CONFIRMED = "Em đang làm tới bước nào rồi? Em gõ bước đó (hoặc bấm 📷 Gửi ảnh) cho cô xem nhé?";
const SAFE_LINES = new Set<string>([...Object.values(SAFE_BY_LEVEL), SAFE_AGAIN, SAFE_STOP, SAFE_CONFIRMED]);

export const isSafeLine = (text: string): boolean => SAFE_LINES.has(text.trim());
/** Every safe line, for the evening report (G8-fix: how often the child got one). */
export const SAFE_LINE_TEXTS: readonly string[] = [...SAFE_LINES];

/** How many of the tutor's latest messages in this problem, newest first, were safe lines (child messages skipped). */
export function safeLinesInARow(history: readonly { role: string; content: string }[]): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]!;
    if (h.role !== "assistant" && h.role !== "tutor") continue;
    if (!isSafeLine(h.content)) break;
    n++;
  }
  return n;
}

/**
 * `inARow`: safe lines the child has just seen in a row (G8-fix: the child saw the same line again and again).
 * `confirmed`: the statement is already confirmed — at H0–H1 the line asks where the child is, not to reread it.
 */
export function safeLine(level: 0 | 1 | 2 | 3 | 4 | 5, inARow = 0, confirmed = false): { message: string; buttons: string[] } {
  if (inARow >= 2) return { message: SAFE_STOP, buttons: [BTN_SAVE] };
  if (inARow === 1) return { message: SAFE_AGAIN, buttons: [BTN_SAVE] };
  if (confirmed && level <= 1) return { message: SAFE_CONFIRMED, buttons: [] };
  return { message: SAFE_BY_LEVEL[level], buttons: level >= 4 ? [BTN_SAVE] : [] };
}

/** G3 — photos (decisions 15/11/2026). */
export const PHOTO_COPY = {
  take: "📷 Chụp ảnh đề",
  pick: "Chọn ảnh có sẵn",
  remove: "Bỏ ảnh",
  retake: "Chụp lại ảnh khác",
  work: "Gửi ảnh bài làm",
  /** G8-fix: the visible label of the photo button in the chat (it used to be an unlabeled camera icon). */
  workShort: "Gửi ảnh",
  hint: "Chụp gọn chỉ bài em cần hỏi. Đừng chụp họ tên, tên trường.",
  unreadable: "Ảnh này máy chưa đọc được. Em chụp bằng camera hoặc gửi ảnh JPG/PNG.",
  tooBig: "Ảnh lớn quá. Em chụp lại gần hơn, chỉ lấy bài cần hỏi nhé.",
  misread: "Cô đọc ảnh chưa đúng. Em gõ đề vào ô dưới, hoặc chụp lại ảnh rõ hơn.",
  tooMany: "Bài này đã đủ ảnh rồi. Em gõ phần còn lại cho cô, hoặc mở bài mới nhé.",
} as const;
/** Stored as the child's message when a photo is sent without typed text. */
export const PHOTO_ONLY_TEXT = "📷 Em gửi ảnh";

/** G6 — approved teaching cards (DOMAIN §4.15) and the "đọc đề" diagnosis. */
export const BTN_NOT_UNDERSTAND_PROBLEM = "Em không hiểu đề";
export const BTN_CARD_OK = "Em hiểu rồi";
export const BTN_CARD_AGAIN = "Giảng lại cách khác";
export const BTN_TRY_AGAIN = "Em thử lại";
export const CARD_BUTTONS = [BTN_CARD_OK, BTN_CARD_AGAIN] as const;
export const DOC_DE_ASK = "Em vướng ở chỗ nào?";
/** Grade 6 gets the first three (no unknowns to set up yet). */
export const DOC_DE_BUTTONS = ["Em không hiểu đề kể chuyện gì", "Em không biết đề hỏi gì",
  "Em không biết dùng kiến thức nào", "Em không biết bắt đầu đặt ẩn"] as const;
export const CARD_AGAIN_INTRO = "Cô giảng cách khác nhé:";
export const CARDS_DONE = "Cô đã giảng 2 cách rồi. Em để dành bài này hỏi thầy, hay thử lại bước vừa rồi?";
export const CARD_MISSING = "Thẻ này đang được cập nhật.";

/** G6b — start-of-session review (D26, Y4, Y5). */
export const REVIEW_COPY = {
  title: "Ôn nhanh",
  recognize: "Chỉ chọn dạng, không cần giải.",
  answer: "Trả lời",
  later: "Để sau",
  correct: "Đúng rồi!",
  wrong: "Chưa đúng — đáp án:",
  seeCard: "Xem lại thẻ",
  unchecked: "Cô kiểm lại sau nhé.",
  placeholder: "Em gõ câu trả lời…",
} as const;

/** D32: "Cô sai ở đây" under each tutor message, and the written comment of the rating card. */
export const FLAG_COPY = {
  open: "Cô sai ở đây",
  ask: "Cô sai thế nào?",
  commentLabel: "Sai ở đâu, sai thế nào? (không bắt buộc)",
  placeholder: "Ví dụ: cô nói luôn kết quả x = 3; hoặc: em không hiểu chữ…",
  send: "Gửi",
  cancel: "Thôi",
  thanks: "Cảm ơn em! Bố mẹ sẽ xem chỗ này.",
  ratingComment: "Cô sai ở đâu, như thế nào? (không bắt buộc)",
} as const;

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

export function safeLine(level: 0 | 1 | 2 | 3 | 4 | 5): { message: string; buttons: string[] } {
  return { message: SAFE_BY_LEVEL[level], buttons: level >= 4 ? [BTN_SAVE] : [] };
}

/** G3 — photos (decisions 15/11/2026). */
export const PHOTO_COPY = {
  take: "📷 Chụp ảnh đề",
  pick: "Chọn ảnh có sẵn",
  remove: "Bỏ ảnh",
  retake: "Chụp lại ảnh khác",
  work: "Gửi ảnh bài làm",
  hint: "Chụp gọn chỉ bài em cần hỏi. Đừng chụp họ tên, tên trường.",
  unreadable: "Ảnh này máy chưa đọc được. Em chụp bằng camera hoặc gửi ảnh JPG/PNG.",
  tooBig: "Ảnh lớn quá. Em chụp lại gần hơn, chỉ lấy bài cần hỏi nhé.",
  misread: "Cô đọc ảnh chưa đúng. Em gõ đề vào ô dưới, hoặc chụp lại ảnh rõ hơn.",
  tooMany: "Bài này đã có 4 ảnh. Em gõ phần còn lại cho cô nhé.",
} as const;
/** Stored as the child's message when a photo is sent without typed text. */
export const PHOTO_ONLY_TEXT = "📷 Em gửi ảnh";

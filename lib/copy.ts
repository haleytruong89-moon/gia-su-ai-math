// lib/copy.ts — fixed Vietnamese lines the app (not the model) says.
/** The model answered but not in the agreed shape: never show raw model text to the child. */
export const SAFE_REPLY = "Cô chưa nghĩ ra cách nói cho rõ. Em gửi lại câu vừa rồi giúp cô nhé.";
/** The model could not be reached (after one retry). */
export const SAFE_BUSY = "Cô đang bận một chút, em gửi lại sau ít phút nhé.";

export const STUCK_LABELS = {
  chua_hieu_de: "Chưa hiểu đề",
  khong_biet_bat_dau: "Không biết bắt đầu",
  lam_do_thi_tac: "Làm dở thì tắc",
  ra_ket_qua_sai: "Ra kết quả sai",
  khong_hieu_buoc: "Không hiểu bước…",
} as const;

export const BACK_TO_LAUNCHER = { href: "/today?tab=hoc-tap", label: "← Về Góc học tập" } as const;

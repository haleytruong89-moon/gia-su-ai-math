// lib/client/post.ts — browser side: POST to the tutor API with the same clientMsgId on every retry.
// fetch() does not add the basePath, so paths are written with /gia-su.
export type PostResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

const NETWORK = "Mạng đang chập chờn. Em bấm Gửi lại nhé.";
const SIGNED_OUT = "Em cần đăng nhập lại ở Study Launcher.";

/** Retries a 409 "pending" (the first send is still running) every 3 s, up to 5 times. */
export async function postWithRetry<T>(path: string, body: object, tries = 5): Promise<PostResult<T>> {
  return send<T>(path, () => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), tries);
}

/** Same, as multipart with a photo (G3). The browser sets the multipart boundary itself. */
export async function postForm<T>(path: string, fields: Record<string, string>, image: Blob | null, tries = 5): Promise<PostResult<T>> {
  return send<T>(path, () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    if (image) fd.set("image", image, "anh.jpg");
    return { body: fd };
  }, tries);
}

async function send<T>(path: string, init: () => RequestInit, tries: number): Promise<PostResult<T>> {
  for (let i = 0; i < tries; i++) {
    let res: Response;
    try {
      res = await fetch(`/gia-su${path}`, { method: "POST", ...init() });
    } catch {
      return { ok: false, status: 0, message: NETWORK };
    }
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    if (res.ok) return { ok: true, data: json as T };
    if (res.status === 409 && json.error === "pending" && i < tries - 1) {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    if (res.status === 401) return { ok: false, status: 401, message: SIGNED_OUT };
    if (res.status === 409 && json.error === "problem_closed") return { ok: false, status: 409, message: "Bài này đã đóng. Em mở bài mới nhé." };
    return { ok: false, status: res.status, message: json.message ?? "Có lỗi, em thử lại sau ít phút nhé." };
  }
  return { ok: false, status: 409, message: "Cô vẫn đang trả lời tin trước. Em đợi một chút rồi gửi lại." };
}

export function newClientMsgId(): string {
  return crypto.randomUUID();
}

export function deviceGuess(): "ipad" | "laptop" {
  const ua = navigator.userAgent;
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ipad ? "ipad" : "laptop";
}

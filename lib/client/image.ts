// lib/client/image.ts — browser side (G3): decode the photo (iPad Safari also reads HEIC), turn it upright,
// shrink to ≤ 2048 px and re-encode as JPEG. The canvas copy carries no EXIF; the server cleans it again.
import { PHOTO_COPY } from "@/lib/copy";

const MAX_EDGE = 2048;
export type PreparedImage = { ok: true; blob: Blob; previewUrl: string } | { ok: false; message: string };

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close() };
  } catch {
    // Older Safari: an <img> applies the EXIF orientation too.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  }
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/") && file.type !== "") return { ok: false, message: PHOTO_COPY.unreadable };
  let pic: Awaited<ReturnType<typeof decode>>;
  try {
    pic = await decode(file);
  } catch {
    return { ok: false, message: PHOTO_COPY.unreadable };
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(pic.width, pic.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(pic.width * scale));
  canvas.height = Math.max(1, Math.round(pic.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, message: PHOTO_COPY.unreadable };
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(pic.source, 0, 0, canvas.width, canvas.height);
  pic.done();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
  if (!blob) return { ok: false, message: PHOTO_COPY.unreadable };
  return { ok: true, blob, previewUrl: URL.createObjectURL(blob) };
}

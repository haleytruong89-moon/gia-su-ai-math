// lib/images.ts — every photo is re-encoded on the server before it is stored or sent to Claude:
// turned upright from its EXIF orientation, all metadata dropped (EXIF, GPS, ICC), sized for Claude,
// JPEG q80 (DOMAIN §2 attachments, §5; DESIGN §7).
import "server-only";
import sharp from "sharp";

/** Claude's standard image tier: bigger images are shrunk by the API anyway, only slower (vision docs, 15/11/2026). */
export const VISION_MAX_EDGE = 1568;
export const VISION_MAX_TOKENS = 1568;
/** The child's browser shrinks photos first, so a request stays under Vercel's 4,5 MB body limit. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ACCEPTED = new Set(["jpeg", "png", "webp"]);
const patches = (w: number, h: number) => Math.ceil(w / 28) * Math.ceil(h / 28);

/** Largest aspect-preserving size that Claude reads without resizing (one visual token per 28×28 patch). */
export function fitForVision(w: number, h: number, maxEdge = VISION_MAX_EDGE, maxTokens = VISION_MAX_TOKENS): [number, number] {
  const fits = (a: number, b: number) =>
    Math.ceil(a / 28) * 28 <= maxEdge && Math.ceil(b / 28) * 28 <= maxEdge && patches(a, b) <= maxTokens;
  if (fits(w, h)) return [w, h];
  if (h > w) {
    const [rh, rw] = fitForVision(h, w, maxEdge, maxTokens);
    return [rw, rh];
  }
  const ratio = w / h;
  let lo = 1;
  let hi = w;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (fits(mid, Math.max(1, Math.round(mid / ratio)))) lo = mid;
    else hi = mid;
  }
  return [lo, Math.max(1, Math.round(lo / ratio))];
}

export type ImageError = "too_big" | "not_an_image";
export type ProcessedImage = { ok: true; jpeg: Buffer; width: number; height: number } | { ok: false; error: ImageError };

export async function processImage(input: Uint8Array): Promise<ProcessedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) return { ok: false, error: "too_big" };
  try {
    const meta = await sharp(input, { failOn: "error", limitInputPixels: 50_000_000 }).metadata();
    if (!meta.format || !ACCEPTED.has(meta.format) || !meta.width || !meta.height) return { ok: false, error: "not_an_image" };
    const sideways = (meta.orientation ?? 1) >= 5;
    const [w0, h0] = sideways ? [meta.height, meta.width] : [meta.width, meta.height];
    const [width, height] = fitForVision(w0, h0);
    // rotate() applies the EXIF orientation; sharp writes no metadata unless asked (withMetadata/keepExif).
    const jpeg = await sharp(input, { failOn: "error", limitInputPixels: 50_000_000 })
      .rotate().resize(width, height, { fit: "fill" }).flatten({ background: "#ffffff" })
      .jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    return { ok: true, jpeg, width, height };
  } catch {
    return { ok: false, error: "not_an_image" };
  }
}

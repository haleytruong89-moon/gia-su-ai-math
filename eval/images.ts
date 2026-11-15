// eval/images.ts — made-up printed sheets drawn from SVG for the photo cases (9.9, 9.11).
// No real photo of the children's work ever goes into this public repo.
import sharp from "sharp";
import { processImage } from "@/lib/images";
import type { ImageData } from "@/lib/tutor/assemble";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Wraps a line to about `max` characters, keeping words whole. */
function wrap(line: string, max = 62): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of line.split(" ")) {
    if ((cur + " " + w).trim().length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

/** A white A4-like page with the lines in black, optionally tilted like a hand-held photo; cleaned like the app does. */
export async function sheet(lines: string[], opts: { rotate?: number } = {}): Promise<ImageData> {
  const rows = lines.flatMap((l) => [...wrap(l), ""]);
  const width = 1400;
  const height = Math.max(900, 120 + rows.length * 46);
  const text = rows.map((r, i) => `<text x="70" y="${110 + i * 46}">${esc(r)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="100%" height="100%" fill="#ffffff"/><g font-family="DejaVu Sans, sans-serif" font-size="30" fill="#111111">${text}</g></svg>`;
  let img = sharp(Buffer.from(svg));
  if (opts.rotate) img = img.rotate(opts.rotate, { background: "#f2f0ea" });
  const r = await processImage(await img.jpeg({ quality: 90 }).toBuffer());
  if (!r.ok) throw new Error(`eval sheet: ${r.error}`);
  return { mediaType: "image/jpeg", data: r.jpeg.toString("base64") };
}

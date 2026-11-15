import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { fitForVision, MAX_UPLOAD_BYTES, processImage } from "@/lib/images";

describe("fitForVision (Claude's standard image size: ≤ 1568 px, ≤ 1568 visual tokens)", () => {
  it("A4 1075×1520 → 924×1307 (example in the Anthropic vision docs)", () => expect(fitForVision(1075, 1520)).toEqual([924, 1307]));
  it("phone photo 4032×3024 → 1269×952; portrait swaps", () => {
    expect(fitForVision(4032, 3024)).toEqual([1269, 952]);
    expect(fitForVision(3024, 4032)).toEqual([952, 1269]);
  });
  it("a small image is left as it is", () => expect(fitForVision(800, 600)).toEqual([800, 600]));
});

describe("processImage", () => {
  const photo = (w: number, h: number, orientation?: number) =>
    sharp({ create: { width: w, height: h, channels: 3, background: "#ffffff" } })
      .withExif({ IFD0: { Copyright: "HS-9A test", Make: "PhoneMaker" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "21/1 0/1 0/1" } })
      .withMetadata(orientation ? { orientation } : {})
      .jpeg().toBuffer();

  it("drops all metadata (EXIF, GPS) and shrinks to the vision size", async () => {
    const r = await processImage(await photo(4032, 3024));
    if (!r.ok) throw new Error(r.error);
    const m = await sharp(r.jpeg).metadata();
    expect([m.format, m.width, m.height, m.exif, m.icc]).toEqual(["jpeg", 1269, 952, undefined, undefined]);
    expect([r.width, r.height]).toEqual([1269, 952]);
  });
  it("a photo taken sideways (EXIF orientation 6) comes out upright", async () => {
    const r = await processImage(await photo(4032, 3024, 6));
    if (!r.ok) throw new Error(r.error);
    expect([r.width, r.height]).toEqual([952, 1269]);
  });
  it("turns a large Boox PNG into a JPEG", async () => {
    const png = await sharp({ create: { width: 1872, height: 1404, channels: 4, background: "#ffffff" } }).png().toBuffer();
    const r = await processImage(png);
    expect(r.ok && [r.width, r.height]).toEqual([1269, 952]);
  });
  it("refuses a non-image (SVG text too) and a too big body", async () => {
    expect(await processImage(new TextEncoder().encode("hello"))).toEqual({ ok: false, error: "not_an_image" });
    expect(await processImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')))
      .toEqual({ ok: false, error: "not_an_image" });
    expect(await processImage(new Uint8Array(MAX_UPLOAD_BYTES + 1))).toEqual({ ok: false, error: "too_big" });
  });
});

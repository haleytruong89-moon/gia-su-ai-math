import { describe, expect, it } from "vitest";
import { isGeometryKu, MAX_IMAGES_GEOMETRY, maxImagesFor } from "@/lib/rules/photoLimit";
import { MAX_IMAGES_PER_PROBLEM } from "@/lib/rules/photo";

describe("photo limit (G8-fix, phụ huynh chốt 24/11: 6 ảnh cho bài hình)", () => {
  it("geometry chapters of grade 9 and grade 6 are geometry lessons", () => {
    for (const c of ["T9.11", "T9.12", "T9.13", "T9.16", "T9.27", "T9.29", "T9.31", "T6.18", "T6.21", "T6.32", "T6.36"]) expect(isGeometryKu(c), c).toBe(true);
  });
  it("algebra, numbers, statistics and unknown codes are not", () => {
    for (const c of ["T9.2", "T9.9", "T9.20", "T9.21", "T9.22", "T6.12", "T6.27", "T6.40", "X9.99"]) expect(isGeometryKu(c), c).toBe(false);
    expect(isGeometryKu(null)).toBe(false);
  });
  it("6 photos for geometry, else 4", () => {
    expect([maxImagesFor("T9.28"), maxImagesFor("T9.3"), maxImagesFor(null)]).toEqual([MAX_IMAGES_GEOMETRY, MAX_IMAGES_PER_PROBLEM, MAX_IMAGES_PER_PROBLEM]);
    expect([MAX_IMAGES_GEOMETRY, MAX_IMAGES_PER_PROBLEM]).toEqual([6, 4]);
  });
});

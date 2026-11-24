// lib/rules/photoLimit.ts — how many photos one problem may have (server only: reads the knowledge bundle).
// Kept apart from lib/rules/photo.ts, which the chat screen imports, so the bundle never ships to the browser.
import { unit } from "@/lib/knowledge/load";
import { MAX_IMAGES_PER_PROBLEM } from "@/lib/rules/photo";

/** G8-fix (phụ huynh chốt 24/11): geometry lessons get 6 — the child redraws and resends the figure. */
export const MAX_IMAGES_GEOMETRY = 6;

/** A lesson of a geometry chapter (KNTT: hệ thức lượng, đường tròn, hình phẳng, hình khối…), read from the knowledge bundle. */
export function isGeometryKu(code: string | null): boolean {
  const u = code ? unit(code) : null;
  return !!u && /hình|đường tròn|hệ thức lượng/i.test(u.chapter);
}

/** Photos allowed for one problem (the problem photo included). Unknown lesson → the normal limit. */
export const maxImagesFor = (kuCode: string | null): number => (isGeometryKu(kuCode) ? MAX_IMAGES_GEOMETRY : MAX_IMAGES_PER_PROBLEM);

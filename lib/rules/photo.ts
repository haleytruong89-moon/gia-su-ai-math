// lib/rules/photo.ts — pure rules for photos of a problem (DOMAIN §4.8, §5; G3 decisions 15/11/2026).
import { addDays, dateVn } from "@/lib/time";

/** Q2: the problem photo, then the child's work — at most 4 per problem. */
export const MAX_IMAGES_PER_PROBLEM = 4;
export const MISREAD_LABEL = "Sai chỗ…";
/** After this many "the tutor misread it" messages, the screen suggests typing the problem or a clearer photo. */
export const MISREAD_HINT_AT = 2;

/** Child messages saying the tutor read the problem wrong ("Sai chỗ…" button or typed "sai chỗ …"). */
export function misreadCount(msgs: readonly { role: "child" | "tutor"; text: string }[]): number {
  return msgs.filter((m) => m.role === "child" && /^sai chỗ/i.test(m.text.trim())).length;
}

/** DOMAIN §4.8: the photo file is deleted 90 days after the Vietnam date it was sent. */
export function deleteAfterVn(now: Date): string {
  return addDays(dateVn(now), 90);
}

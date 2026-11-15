// lib/tutor/lines.ts — how the app counts the lines of a tutor message (max_lines rule).
export const messageLines = (m: string) => m.split("\n").filter((l) => l.trim().length > 0).length;

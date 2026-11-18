// lib/report/attention.ts — at most 2 "cần chú ý" lines per child / day for the Launcher
// (study-launcher 0021 public.learning_attention: slot 1–2, body 1–160 characters, parents only).
import type { Flag } from "./flags";

const MAX = 160;
const fit = (s: string) => (s.length <= MAX ? s : `${s.slice(0, MAX - 1)}…`);

/** dayFlags already returns flags in the parents' priority order (X1, chốt 19/11/2026). */
export const attentionLines = (flags: Flag[]): string[] => flags.slice(0, 2).map((x) => fit(x.text));

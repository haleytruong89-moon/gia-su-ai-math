// Privacy check for the knowledge files of this PUBLIC repo (D9). Generic markers live here;
// real names (children, school, teachers) never do: they come from the PRIVATE_TERMS secret.

export const GENERIC_PATTERNS: RegExp[] = [
  /đã gặp ở/i, /\bthầy\b/i, /cô giáo/i, /đề cương/i, /giữa kỳ/i, /barem/i, /⚠️/, /HS-[69]A/,
  /trường\s+THCS/i, /chuyên\s+(Anh|Toán)/i, /ý chặn/i, /@[a-z0-9.-]+\.[a-z]{2,}/i,
];

export const termsFromEnv = (v = process.env.PRIVATE_TERMS): string[] =>
  (v ?? "").split(",").map((t) => t.trim()).filter((t) => t.length >= 2);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Lines that look private: generic patterns + extra terms (whole words, any case). Only line numbers are reported. */
export function privacyHits(text: string, extraTerms: string[] = []): { line: number; match: string }[] {
  const extra = extraTerms.map((t) => new RegExp(`(^|[^\\p{L}])${escape(t)}($|[^\\p{L}])`, "iu"));
  const hits: { line: number; match: string }[] = [];
  text.split("\n").forEach((l, i) => {
    const p = GENERIC_PATTERNS.find((r) => r.test(l));
    if (p) hits.push({ line: i + 1, match: p.source });
    else if (extra.some((r) => r.test(l))) hits.push({ line: i + 1, match: "PRIVATE_TERMS" });
  });
  return hits;
}

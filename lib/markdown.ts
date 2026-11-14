// lib/markdown.ts — the tiny subset of markdown the tutor uses (DESIGN: "markdown đơn giản"):
// line breaks and **bold**. Rendered as React text nodes, so nothing from the model is HTML.
export type Run = { text: string; bold: boolean };

export function lines(text: string): Run[][] {
  return text.split("\n").map((line) => {
    const parts = line.split("**");
    if (parts.length < 3 || parts.length % 2 === 0) return line ? [{ text: line, bold: false }] : [];
    return parts.map((p, i) => ({ text: p, bold: i % 2 === 1 })).filter((r) => r.text.length > 0);
  });
}

// lib/cardBlocks.ts — the markdown of an approved card → blocks the app renders as React text
// (paragraphs, "- " lists, | tables |, **bold**, *italic*). Never HTML.
export type CardRun = { text: string; bold: boolean; italic: boolean };
export type CardBlock =
  | { t: "p"; runs: CardRun[] }
  | { t: "ul"; items: CardRun[][] }
  | { t: "table"; rows: CardRun[][][] };

export function runsOf(text: string): CardRun[] {
  const out: CardRun[] = [];
  text.split("**").forEach((part, i) => {
    const bold = i % 2 === 1;
    part.split(/(?<![*\w])\*(?!\s)|(?<!\s)\*(?![*\w])/).forEach((p, j) => {
      if (p) out.push({ text: p, bold, italic: j % 2 === 1 });
    });
  });
  return out;
}

const cells = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const isSep = (l: string) => cells(l).every((c) => /^:?-{2,}:?$/.test(c));

export function cardBlocks(md: string): CardBlock[] {
  const blocks: CardBlock[] = [];
  const lines = md.split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: "p", runs: runsOf(para.join("\n")) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (!l.trim()) { flush(); continue; }
    if (l.startsWith("- ")) {
      flush();
      const items: CardRun[][] = [];
      while (i < lines.length && lines[i]!.startsWith("- ")) items.push(runsOf(lines[i++]!.slice(2)));
      i--;
      blocks.push({ t: "ul", items });
      continue;
    }
    if (l.trimStart().startsWith("|")) {
      flush();
      const rows: CardRun[][][] = [];
      while (i < lines.length && lines[i]!.trimStart().startsWith("|")) {
        if (!isSep(lines[i]!)) rows.push(cells(lines[i]!).map(runsOf));
        i++;
      }
      i--;
      blocks.push({ t: "table", rows });
      continue;
    }
    para.push(l);
  }
  flush();
  return blocks;
}

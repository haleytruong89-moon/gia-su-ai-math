// Turns the hub's knowledge files (private, with notes about the children, their teachers and school)
// into the public-safe sources in knowledge/src/. Pure rules; the CLI at the bottom reads knowledge/hub/.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { privacyHits, termsFromEnv } from "./privacy";

export interface SanitizeRules {
  dropColumns: string[];
  /** Headings whose whole section (until the next heading of the same or a higher level) is removed. */
  dropSections: RegExp[];
  /** Paragraphs (runs of non-blank lines) whose first line matches are removed. */
  dropBlocks: RegExp[];
  /** "( … )" groups whose content matches are removed. */
  dropParens: RegExp[];
  /** Table cells are split on ";": a part matching one of these is removed. */
  dropCellParts: RegExp[];
  replaceText: [RegExp, string][];
}

const PRIVATE = /đã gặp|thầy|barem|giữa kỳ|đề cương|nhận xét|ý chặn/i;

export const RULES: SanitizeRules = {
  dropColumns: ["Đề cương HK I", "Ý chặn (theo thầy)", "Học ở trường", "Ví dụ (đã kiểm)"],
  dropSections: [
    /^## 4\. Dạng đề cương/, /^## 4\. Đang học/, /^### 2\.1\./, /^### 2\.2\./, /^## 2\. Ví dụ mẫu/,
    /^## 3\. Dùng cho gói chủ đề/, /^## 5\. Danh sách kiểm/, /^## 6\. Gói chủ đề/,
  ],
  dropBlocks: [/^Đề \(IV\.\d\)/, /^\*\*Ngưỡng điểm/, /^\*\*Hệ quả cho gia sư AI/, /^Dùng P = /, /nhờ thầy/],
  dropParens: [PRIVATE],
  dropCellParts: [/giữa kỳ|thầy|đã gặp|ý chặn/i],
  replaceText: [[/ — ví dụ từ bài giữa kỳ I/g, ""]],
};

/** Hub file → knowledge/src/<out>.md. */
export const SOURCES: { hub: string; out: string }[] = [
  { hub: "BAN_DO_CHUONG_TRINH_TOAN9_v0.2.md", out: "toan9" },
  { hub: "BAN_DO_CHUONG_TRINH_TOAN6_v0.1.md", out: "toan6" },
  { hub: "HOP_CONG_CU_HINH_9_v0.2.md", out: "hinh9" },
  { hub: "HOP_CONG_CU_RUT_GON_9_v0.1.md", out: "rutgon9" },
];

const PIPE = "\u0000";
const splitRow = (line: string): string[] =>
  line.replace(/\\\|/g, PIPE).trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim().replaceAll(PIPE, "\\|"));
const joinRow = (cells: string[]) => `| ${cells.join(" | ")} |`;
const isRow = (l: string) => l.trimStart().startsWith("|");
const headingLevel = (l: string) => /^(#{1,6}) /.exec(l)?.[1]!.length ?? 0;

function cleanText(s: string, r: SanitizeRules): string {
  let t = s.replace(/\s+—\s+⚠️.*$/u, "");
  for (let prev = ""; prev !== t;) {
    prev = t;
    t = t.replace(/\s*\(([^()]*)\)/g, (m, inner: string) => (r.dropParens.some((p) => p.test(inner)) ? "" : m));
  }
  return t;
}

function cleanCell(cell: string, r: SanitizeRules): string {
  const parts = cleanText(cell, r).split(/;\s*/).map((p) => p.trim()).filter((p) => p && !r.dropCellParts.some((x) => x.test(p)));
  return parts.join("; ");
}

export function sanitize(md: string, source: string, rules: SanitizeRules = RULES): string {
  let text = md;
  for (const [re, by] of rules.replaceText) text = text.replace(re, by);
  const lines = text.split("\n");

  // 1. Sections.
  const kept: string[] = [];
  for (let i = 0, skipLevel = 0; i < lines.length; i++) {
    const l = lines[i]!;
    const lv = headingLevel(l);
    if (skipLevel && lv && lv <= skipLevel) skipLevel = 0;
    if (!skipLevel && lv && rules.dropSections.some((re) => re.test(l))) skipLevel = lv;
    if (!skipLevel) kept.push(l);
  }

  // 2. Blockquotes (all of them: they carry dates, sources and notes) and private paragraphs.
  const out: string[] = [];
  for (let i = 0; i < kept.length; i++) {
    const l = kept[i]!;
    if (l.trimStart().startsWith(">")) continue;
    if (!isRow(l) && rules.dropBlocks.some((re) => re.test(l))) {
      while (i + 1 < kept.length && kept[i + 1]!.trim() !== "") i++;
      continue;
    }
    out.push(l);
  }

  // 3. Tables: drop columns, clean cells. Other lines: clean text.
  const result: string[] = [];
  for (let i = 0; i < out.length; i++) {
    if (!isRow(out[i]!)) {
      result.push(cleanText(out[i]!, rules));
      continue;
    }
    const header = splitRow(out[i]!);
    const drop = new Set(header.map((h, k) => (rules.dropColumns.includes(h) ? k : -1)).filter((k) => k >= 0));
    for (; i < out.length && isRow(out[i]!); i++) {
      const cells = splitRow(out[i]!).filter((_, k) => !drop.has(k));
      result.push(cells.every((c) => /^:?-+:?$/.test(c)) ? `|${cells.map(() => "---").join("|")}|` : joinRow(cells.map((c) => cleanCell(c, rules))));
    }
    i--;
  }

  // 4. One source line under the title; no runs of blank lines.
  const titleAt = result.findIndex((l) => l.startsWith("# "));
  const note = `> Nguồn: hub \`${source}\` (bản sạch cho repo công khai; sinh bằng scripts/knowledge/sanitize.ts).`;
  result.splice(titleAt + 1, 0, note);
  return result.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// CLI: knowledge/hub/<hub file> → knowledge/src/<out>.md, then the privacy check (line numbers only).
if (process.argv[1]?.endsWith("sanitize.ts")) {
  let failed = false;
  for (const s of SOURCES) {
    const from = `knowledge/hub/${s.hub}`;
    if (!existsSync(from)) {
      console.log(`skip ${s.hub} (not in knowledge/hub/)`);
      continue;
    }
    const clean = sanitize(readFileSync(from, "utf8"), s.hub);
    const hits = privacyHits(clean, termsFromEnv());
    if (hits.length) {
      failed = true;
      console.error(`${s.out}.md: private text on lines ${hits.map((h) => h.line).join(", ")}`);
    }
    writeFileSync(`knowledge/src/${s.out}.md`, clean);
    console.log(`wrote knowledge/src/${s.out}.md`);
  }
  if (failed) process.exit(1);
}

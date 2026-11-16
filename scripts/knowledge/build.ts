// knowledge/src/*.md → knowledge/knowledge.json + knowledge/KNOWLEDGE_VERSION (D25). Do not edit the JSON by hand.
//   npm run knowledge        sanitize (if knowledge/hub/ exists) + build + write
//   npm run knowledge:check  rebuild in memory, compare with the files, privacy check (CI)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { KU_CODE, KnowledgeBundle, ROOTS, type ChecklistItem, type KnowledgeUnit, type ToolboxSection } from "../../lib/knowledge/schema";
import { privacyHits, termsFromEnv } from "./privacy";

export type Sources = Record<"toan9" | "toan6" | "hinh9" | "rutgon9" | "MAP", string>;
export const SOURCE_KEYS = ["toan9", "toan6", "hinh9", "rutgon9", "MAP"] as const;
const TOOLBOX_MAX = 2200; // hinh.1.10 (similar triangles, a–d) is ~2.1k characters and must stay whole

// ---------- markdown helpers ----------
const PIPE = "\u0000";
const cellsOf = (line: string): string[] =>
  line.replace(/\\\|/g, PIPE).trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim().replaceAll(PIPE, "|"));
const isRow = (l: string) => l.trimStart().startsWith("|");
const isSeparator = (cells: string[]) => cells.every((c) => /^:?-+:?$/.test(c));
const plain = (s: string) => s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
const headingOf = (l: string) => /^(#{1,6}) (.*)$/.exec(l);

export interface Table { headings: string[]; header: string[]; rows: string[][] }

/** Every table with the headings above it (outermost first). */
export function parseTables(md: string): Table[] {
  const out: Table[] = [];
  const stack: string[] = [];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const h = headingOf(lines[i]!);
    if (h) {
      stack.length = h[1]!.length - 1;
      stack[h[1]!.length - 1] = h[2]!.trim();
      continue;
    }
    if (!isRow(lines[i]!)) continue;
    const header = cellsOf(lines[i]!);
    const rows: string[][] = [];
    for (i++; i < lines.length && isRow(lines[i]!); i++) {
      const c = cellsOf(lines[i]!);
      if (!isSeparator(c)) rows.push(c);
    }
    i--;
    out.push({ headings: stack.filter(Boolean), header, rows });
  }
  return out;
}

/** KU codes in a text; "T6.4–T6.6" and "T9.7–T9.10" are expanded. */
export function codesIn(text: string): string[] {
  const out: string[] = [];
  const re = /(T6|T9|N7|N8|TH)\.(\d{1,2})(?:\s*[–-]\s*(?:\1\.)?(\d{1,2}))?/g;
  for (const m of text.replace(/\([^()]*\)/g, "").matchAll(re)) {
    const from = Number(m[2]);
    const to = m[3] ? Number(m[3]) : from;
    for (let n = from; n <= to; n++) out.push(`${m[1]}.${m[1] === "TH" || m[1]!.startsWith("N") ? String(n).padStart(2, "0") : n}`);
  }
  return [...new Set(out)].filter((c) => KU_CODE.test(c));
}

const ROOT_MARK: [string, (typeof ROOTS)[number]][] = [["🧩a", "concept"], ["🧩b", "strategy"], ["📖", "read"], ["🧮", "calc"], ["🎯", "careful"]];
function errorsOf(cell: string): KnowledgeUnit["errors"] {
  if (/^—?$/.test(cell.trim())) return [];
  return cell.split(/;\s*/).map((part) => {
    const p = part.trim();
    const mark = ROOT_MARK.find(([m]) => p.startsWith(m));
    return { root: mark?.[1] ?? null, text: plain(mark ? p.slice(mark[0].length) : p) };
  }).filter((e) => e.text);
}

// ---------- curriculum maps ----------
function unitsOf(md: string, grade: 6 | 9): KnowledgeUnit[] {
  const units: KnowledgeUnit[] = [];
  for (const t of parseTables(md)) {
    const col = (name: string) => t.header.indexOf(name);
    if (col("Mã") < 0) continue;
    const top = t.headings[1] ?? "";
    const isBg = col("Kiến thức") >= 0;
    for (const r of t.rows) {
      const code = r[col("Mã")]!;
      if (!KU_CODE.test(code)) continue;
      const get = (name: string) => (col(name) >= 0 ? r[col(name)] ?? "" : "");
      units.push(isBg
        ? { code, grade, level: "nen", term: "nen", chapter: plain(top), title: plain(get("Kiến thức")), core: "", problemTypes: "",
          errors: [], prereqs: [], usedBy: codesIn(get("Dùng cho")), checklist: [], toolbox: [], proof: false }
        : { code, grade, level: "bai", term: top.startsWith("2.") ? "HK2" : "HK1", chapter: plain(t.headings[2] ?? ""),
          title: plain(get("Bài")), core: plain(get("Cốt lõi")), problemTypes: plain(get("Dạng bài chính")),
          errors: errorsOf(get("Lỗi hay gặp")), prereqs: codesIn(get("Nền cần")), usedBy: [], checklist: [], toolbox: [], proof: false });
    }
  }
  return units;
}

// ---------- toolboxes ----------
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const lines = text.split("\n");
  const kept: string[] = [];
  let n = 0;
  for (const l of lines) {
    if (n + l.length + 1 > max - 2) break;
    kept.push(l);
    n += l.length + 1;
  }
  return `${kept.join("\n")}\n…`;
}

/** depth 3: a "##" section with "###" children becomes one entry per child; otherwise one entry per "##". */
function toolboxOf(md: string, prefix: "hinh" | "rutgon", depth: 2 | 3): ToolboxSection[] {
  const lines = md.split("\n");
  const heads = lines.map((l, i) => ({ i, h: headingOf(l) })).filter((x) => x.h && x.h[1]!.length >= 2 && x.h[1]!.length <= 3);
  const out: ToolboxSection[] = [];
  const sectionEnd = (i: number, level: number) => {
    for (let j = i + 1; j < lines.length; j++) {
      const h = headingOf(lines[j]!);
      if (h && h[1]!.length <= level) return j;
    }
    return lines.length;
  };
  for (const { i, h } of heads) {
    const level = h![1]!.length;
    const m = /^(\d+(?:\.\d+)?)\.\s+(.*)$/.exec(h![2]!);
    if (!m) continue;
    const end = sectionEnd(i, level);
    const hasChildren = lines.slice(i + 1, end).some((l) => headingOf(l)?.[1]!.length === 3);
    const take = level === 2 ? !(depth === 3 && hasChildren) : depth === 3;
    if (!take) continue;
    const body = lines.slice(i + 1, end).join("\n").trim();
    out.push({ id: `${prefix}.${m[1]}`, title: plain(m[2]!), text: clip(body, TOOLBOX_MAX) });
  }
  return out;
}

// ---------- MAP ----------
const numbers = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
function toolboxIds(cell: string): string[] {
  if (/^—?$/.test(cell.trim())) return [];
  return cell.split(/,\s*/).flatMap((p) => {
    const r = /^(hinh|rutgon)\.(\d+)\.(\d+)–\1\.\2\.(\d+)$/.exec(p.trim());
    if (!r) return [p.trim()];
    return Array.from({ length: Number(r[4]) - Number(r[3]) + 1 }, (_, k) => `${r[1]}.${r[2]}.${Number(r[3]) + k}`);
  });
}

function mapOf(md: string) {
  const checklist: ChecklistItem[] = [];
  const byCode = new Map<string, { checklist: number[]; toolbox: string[] }>();
  const defaults = { g6: [] as number[], g9: [] as number[] };
  for (const t of parseTables(md)) {
    const top = t.headings[1] ?? "";
    const g = /lớp (6|9)/.exec(top);
    if (t.header[0] === "#" && g) {
      for (const r of t.rows) checklist.push({ grade: Number(g[1]) as 6 | 9, n: Number(r[0]), text: plain(r[1]!) });
    } else if (t.header[0] === "KU") {
      for (const r of t.rows) {
        const entry = { checklist: numbers(r[1]!), toolbox: toolboxIds(r[2]!) };
        const d = /^lớp (6|9)/.exec(r[0]!);
        if (d) defaults[`g${d[1]}` as "g6" | "g9"] = entry.checklist;
        else for (const c of codesIn(r[0]!)) byCode.set(c, entry);
      }
    }
  }
  const proofLine = md.split("\n").find((l, i, all) => i > 0 && /^## KU là bài hình chứng minh/.test(all[i - 1] ?? "")) ?? "";
  return { checklist, byCode, defaults, proof: new Set(codesIn(proofLine)) };
}

// ---------- bundle ----------
export function buildBundle(src: Sources, date: string) {
  const map = mapOf(src.MAP);
  const units = [...unitsOf(src.toan9, 9), ...unitsOf(src.toan6, 6)].map((u) => {
    if (u.level === "nen") return u;
    const m = map.byCode.get(u.code);
    return { ...u, checklist: m?.checklist ?? (u.grade === 6 ? map.defaults.g6 : map.defaults.g9),
      toolbox: m?.toolbox ?? [], proof: map.proof.has(u.code) };
  });
  const hash = createHash("sha256").update(SOURCE_KEYS.map((k) => src[k]).join("\n\u0000\n")).digest("hex").slice(0, 8);
  return KnowledgeBundle.parse({
    version: `${date}.${hash}`, units,
    toolbox: [...toolboxOf(src.hinh9, "hinh", 3), ...toolboxOf(src.rutgon9, "rutgon", 2)],
    checklist: map.checklist, defaults: map.defaults,
  });
}

// ---------- CLI ----------
const readSources = (): Sources =>
  Object.fromEntries(SOURCE_KEYS.map((k) => [k, readFileSync(`knowledge/src/${k}.md`, "utf8")])) as Sources;
const pretty = (b: unknown) => `${JSON.stringify(b, null, 2)}\n`;
const todayVn = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

if (process.argv[1]?.endsWith("build.ts")) {
  const check = process.argv.includes("--check");
  const src = readSources();
  if (!check) {
    const b = buildBundle(src, todayVn());
    writeFileSync("knowledge/knowledge.json", pretty(b));
    writeFileSync("knowledge/KNOWLEDGE_VERSION", `${b.version}\n`);
    console.log(`knowledge ${b.version}: ${b.units.length} units, ${b.toolbox.length} toolbox sections`);
  } else {
    let failed = false;
    const version = readFileSync("knowledge/KNOWLEDGE_VERSION", "utf8").trim();
    const b = buildBundle(src, version.split(".")[0]!);
    if (b.version !== version || pretty(b) !== readFileSync("knowledge/knowledge.json", "utf8")) {
      failed = true;
      console.error("knowledge/knowledge.json is out of date with knowledge/src: run `npm run knowledge` and commit.");
    }
    const terms = termsFromEnv();
    if (!terms.length) console.warn("PRIVATE_TERMS is not set: only the generic privacy patterns were checked.");
    for (const f of [...SOURCE_KEYS.map((k) => `knowledge/src/${k}.md`), "knowledge/knowledge.json"]) {
      const hits = privacyHits(readFileSync(f, "utf8"), terms);
      if (hits.length) {
        failed = true;
        console.error(`${f}: private text on lines ${hits.map((h) => h.line).join(", ")}`);
      }
    }
    if (failed) process.exit(1);
    console.log(`knowledge ${version}: up to date, no private text found`);
  }
}

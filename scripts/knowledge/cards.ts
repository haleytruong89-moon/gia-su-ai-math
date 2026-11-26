// knowledge/src/cards/*.md → knowledge/cards.json + knowledge/CARDS_VERSION (G6, design C). Do not edit the JSON by hand.
//   npm run cards         build + write
//   npm run cards:check   rebuild in memory, compare with the files, privacy check (CI)
// The SymPy "kiểm:" lines are checked by cas/tests/test_cards.py (CI cas job).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { kindOfCode } from "../../lib/knowledge/cardCodes";
import { Card, type CardBundle } from "../../lib/knowledge/cardSchema";
import { privacyHits, termsFromEnv } from "./privacy";

const DIR = "knowledge/src/cards";

function header(md: string): Record<string, string> {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (!m) throw new Error("missing --- header ---");
  return Object.fromEntries(m[1]!.split("\n").map((l) => {
    const i = l.indexOf(":");
    if (i < 0) throw new Error(`bad header line: ${l}`);
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }));
}

function sections(md: string): { title: string; text: string }[] {
  return md.replace(/^---\n[\s\S]*?\n---\n/, "").split(/^## /m).slice(1).map((s) => {
    const nl = s.indexOf("\n");
    return { title: s.slice(0, nl).trim(), text: s.slice(nl + 1) };
  });
}

function variant(title: string, text: string) {
  const m = /^Cách ([12]) — (.+)$/.exec(title);
  if (!m) throw new Error(`way heading must be "Cách 1 — …": ${title}`);
  const lines = text.split("\n");
  const keyNumbers = lines.filter((l) => l.startsWith("số:")).flatMap((l) => l.slice(3).split(",").map((s) => s.trim()).filter(Boolean));
  const keyLabels = lines.filter((l) => l.startsWith("nhãn:")).flatMap((l) => l.slice(5).split(",").map((s) => s.trim()).filter(Boolean));
  const checks = lines.filter((l) => l.startsWith("kiểm:")).map((l) => l.slice(5).trim());
  // The machine lines sit in an HTML comment so GitHub's preview of the card stays readable for the parents.
  const machine = (l: string) => l.startsWith("số:") || l.startsWith("nhãn:") || l.startsWith("kiểm:") || l.trim().startsWith("<!--") || l.trim() === "-->";
  const body = lines.filter((l) => !machine(l)).join("\n").trim();
  return { n: Number(m[1]) as 1 | 2, title: m[2]!.trim(), body, keyNumbers, ...(keyLabels.length ? { keyLabels } : {}), checks };
}

function review(text: string) {
  const items = text.split(/^- /m).slice(1);
  return items.map((it) => {
    const [first, ...rest] = it.split("\n");
    const head = Object.fromEntries(first!.split("·").map((p) => p.split(":").map((s) => s.trim())));
    const field = (name: string) => {
      const l = rest.find((x) => x.trim().startsWith(`${name}:`));
      return l === undefined ? undefined : l.trim().slice(name.length + 1).trim();
    };
    const buttons = (field("buttons") ?? "").split("|").map((s) => s.trim()).filter(Boolean);
    return { key: head.key, kind: head.kind, check: head.check, prompt: field("prompt"), buttons, answer: field("answer") };
  });
}

/** One card file → a validated card. Throws with a reason. */
export function parseCardMd(md: string): Card {
  const h = header(md);
  const secs = sections(md);
  const ways = secs.filter((s) => s.title.startsWith("Cách ")).map((s) => variant(s.title, s.text));
  const rev = secs.find((s) => s.title === "Câu ôn");
  if (ways.length !== 2 || ways[0]!.n !== 1 || ways[1]!.n !== 2) throw new Error("a card needs exactly 2 ways: Cách 1, Cách 2 (C2)");
  if (!rev) throw new Error("missing ## Câu ôn");
  const stepsSec = secs.find((s) => s.title === "Các bước");
  const steps = stepsSec ? stepsSec.text.split("\n").map((l) => /^- (.+)$/.exec(l.trim())?.[1]?.trim()).filter((x): x is string => !!x) : undefined;
  const card = Card.parse({
    code: h.code, grade: Number(h.grade), kind: h.kind, ku: h.ku, title: h.title, variants: ways, review: review(rev.text),
    ...(steps ? { steps } : {}),
  });
  if (kindOfCode(card.code) !== card.kind) throw new Error(`${card.code}: a ${kindOfCode(card.code)} code cannot be kind ${card.kind}`);
  for (const q of card.review) {
    if (q.check === "exact" && !q.buttons.includes(q.answer)) throw new Error(`${card.code} ${q.key}: an exact answer must be one of the buttons`);
    if (q.check === "math_check" && q.buttons.length) throw new Error(`${card.code} ${q.key}: a math_check question is typed, no buttons`);
  }
  return card;
}

export function buildCards(files: Record<string, string>, date: string): CardBundle {
  const cards = Object.entries(files).map(([name, md]) => {
    try {
      return parseCardMd(md);
    } catch (e) {
      throw new Error(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }).sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
  const seen = new Set<string>();
  for (const c of cards) {
    if (seen.has(c.code)) throw new Error(`duplicate card ${c.code}`);
    seen.add(c.code);
  }
  const hash = createHash("sha256").update(JSON.stringify(cards)).digest("hex").slice(0, 8);
  return { version: `${date}.${hash}`, cards };
}

const pretty = (b: CardBundle) => `${JSON.stringify(b, null, 2)}\n`;
const readSources = () => Object.fromEntries(readdirSync(DIR).filter((f) => f.endsWith(".md")).sort().map((f) => [f, readFileSync(`${DIR}/${f}`, "utf8")]));

if (process.argv[1]?.endsWith("cards.ts")) {
  const check = process.argv.includes("--check");
  const src = readSources();
  const hits = privacyHits(Object.values(src).join("\n"), termsFromEnv(process.env.PRIVATE_TERMS));
  if (hits.length) {
    console.error(`cards: private text found (${hits.length})`);
    process.exit(1);
  }
  if (!check) {
    const date = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const b = buildCards(src, date);
    writeFileSync("knowledge/cards.json", pretty(b));
    writeFileSync("knowledge/CARDS_VERSION", `${b.version}\n`);
    console.log(`cards ${b.version}: ${b.cards.length} cards`);
  } else {
    const version = readFileSync("knowledge/CARDS_VERSION", "utf8").trim();
    const b = buildCards(src, version.split(".")[0]!);
    if (b.version !== version || pretty(b) !== readFileSync("knowledge/cards.json", "utf8")) {
      console.error("cards: knowledge/cards.json is out of date — run npm run cards");
      process.exit(1);
    }
    console.log(`cards ${version}: up to date, no private text found`);
  }
}

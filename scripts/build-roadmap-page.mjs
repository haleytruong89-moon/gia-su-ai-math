// Builds the progress map page: docs/roadmap-page/index.html with docs/ROADMAP.json embedded
// as a fallback snapshot, plus roadmap.json next to it. Output: .roadmap-site/ (published as an artifact).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const json = readFileSync("docs/ROADMAP.json", "utf8");
JSON.parse(json); // fail loudly on invalid JSON
const page = readFileSync("docs/roadmap-page/index.html", "utf8");
const marker = "/*SNAPSHOT*/";
if (!page.includes(marker)) throw new Error("snapshot marker missing in index.html");
const safe = json.replace(/</g, "\\u003c");
mkdirSync(".roadmap-site", { recursive: true });
writeFileSync(".roadmap-site/index.html", page.replace(marker, () => safe));
writeFileSync(".roadmap-site/roadmap.json", json);
console.log("built .roadmap-site/index.html + roadmap.json");

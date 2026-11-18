// lib/tutor/layers.ts — the reviewed prompt layers ① ② ③ (prompts/*.md), read once per server.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Layers { role: string; rules: string; method: string; guard: string; sibling: string; classify: string; ruleDraft?: string }

const read = (file: string) => readFileSync(join(process.cwd(), "prompts", file), "utf8").trim();
let cached: { layers: Layers; version: string } | null = null;

function load() {
  cached ??= {
    layers: { role: read("role.md"), rules: read("rules.md"), method: read("method.md"), guard: read("guard.md"), sibling: read("sibling.md"),
      classify: read("classify.md"), ruleDraft: read("rule_draft.md") },
    version: read("PROMPT_VERSION"),
  };
  return cached;
}

export const loadLayers = (): Layers => load().layers;
export const promptVersion = (): string => load().version;

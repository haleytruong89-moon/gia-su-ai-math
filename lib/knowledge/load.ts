// The knowledge bundle (D25), parsed once. Built by `npm run knowledge`; never edited by hand.
import data from "@/knowledge/knowledge.json";
import { KnowledgeBundle, type KnowledgeUnit, type ToolboxSection } from "./schema";

export const KNOWLEDGE: KnowledgeBundle = KnowledgeBundle.parse(data);
export const knowledgeVersion = KNOWLEDGE.version;

const units = new Map(KNOWLEDGE.units.map((u) => [u.code, u]));
const toolbox = new Map(KNOWLEDGE.toolbox.map((t) => [t.id, t]));

export const unit = (code: string): KnowledgeUnit | null => units.get(code) ?? null;
export const section = (id: string): ToolboxSection | null => toolbox.get(id) ?? null;

/** A KU code is usable for a grade: grade 9 → T9, N7, N8; grade 6 → T6, TH. Unknown codes never fit. */
export function codeFitsGrade(code: string, grade: 6 | 9): boolean {
  const u = units.get(code);
  return !!u && u.grade === grade;
}

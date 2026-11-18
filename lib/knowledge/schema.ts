// Shape of knowledge/knowledge.json (D25). Built by scripts/knowledge/build.ts from knowledge/src/*.md.
import { z } from "zod";

export const ROOTS = ["read", "concept", "strategy", "calc", "careful"] as const;
export const KU_CODE = /^(T6|T9|N7|N8|TH)\.[0-9]{1,2}$/;
const grade = z.union([z.literal(6), z.literal(9)]);

export const KnowledgeUnit = z.object({
  code: z.string().regex(KU_CODE),
  /** The program it serves: N7/N8 units serve grade 9, TH units grade 6. */
  grade,
  level: z.enum(["bai", "nen"]),
  term: z.enum(["HK1", "HK2", "nen"]),
  chapter: z.string(),
  title: z.string(),
  core: z.string(),
  problemTypes: z.string(),
  errors: z.array(z.object({ root: z.enum(ROOTS).nullable(), text: z.string() })),
  prereqs: z.array(z.string().regex(KU_CODE)),
  /** Background units: the lessons that need them. */
  usedBy: z.array(z.string()),
  checklist: z.array(z.number().int().min(1).max(10)),
  toolbox: z.array(z.string()),
  /** A geometry lesson whose problems are usually proofs (Opus signal for grade 9, §4.14). */
  proof: z.boolean(),
});

export const ToolboxSection = z.object({ id: z.string().regex(/^(hinh|rutgon)\.[0-9.]+$/), title: z.string(), text: z.string() });
export const ChecklistItem = z.object({ grade, n: z.number().int().min(1), text: z.string() });

export const KnowledgeBundle = z.object({
  version: z.string(),
  units: z.array(KnowledgeUnit),
  toolbox: z.array(ToolboxSection),
  checklist: z.array(ChecklistItem),
  /** Checklist items for a lesson the map does not list. */
  defaults: z.object({ g6: z.array(z.number().int()), g9: z.array(z.number().int()) }),
});

export type KnowledgeUnit = z.infer<typeof KnowledgeUnit>;
export type ToolboxSection = z.infer<typeof ToolboxSection>;
export type ChecklistItem = z.infer<typeof ChecklistItem>;
export type KnowledgeBundle = z.infer<typeof KnowledgeBundle>;

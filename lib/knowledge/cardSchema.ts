// lib/knowledge/cardSchema.ts — approved teaching cards (G6, design C). Source: knowledge/src/cards/*.md,
// built into knowledge/cards.json by scripts/knowledge/cards.ts. Never edit the JSON by hand.
import { z } from "zod";

export const CARD_CODE = /^(T6|T9|N7|N8|TH|D6|D9)\.[0-9]{1,2}$/;
export const CARD_REF = /^((?:T6|T9|N7|N8|TH|D6|D9)\.[0-9]{1,2})#([12])$/;

export const CardVariant = z.object({
  n: z.union([z.literal(1), z.literal(2)]),
  title: z.string().min(3).max(80),
  /** Markdown shown verbatim to the child (paragraphs, "- " lists, | tables |, **bold**). */
  body: z.string().min(50).max(4000),
  /** The example's numbers: the server never shows a way whose numbers are the child's problem's. */
  keyNumbers: z.array(z.string().min(1)),
  /** G6d: point names of a geometry example (PQR, PK) — compared with the child's figure like the numbers. */
  keyLabels: z.array(z.string().regex(/^[A-Z]{2,}$/)).min(1).optional(),
  /** SymPy lines, all True (cas/tests/test_cards.py). */
  checks: z.array(z.string().min(3)).min(1),
}).strict().refine((v) => v.keyNumbers.length > 0 || (v.keyLabels?.length ?? 0) > 0, {
  message: "a way needs its numbers (số:) or, for a geometry example, its point names (nhãn:) for the clash check",
});

export const ReviewQuestion = z.object({
  key: z.string().regex(/^[a-z0-9_]{2,20}$/),
  kind: z.enum(["why", "recognize", "formula", "mini_problem"]),
  prompt: z.string().min(5).max(400),
  buttons: z.array(z.string().min(1).max(60)).max(4),
  answer: z.string().min(1).max(200),
  check: z.enum(["exact", "math_check"]),
}).strict();

export const Card = z.object({
  code: z.string().regex(CARD_CODE),
  grade: z.union([z.literal(6), z.literal(9)]),
  kind: z.enum(["ban_chat", "doc_de"]),
  /** The lesson the card belongs to (a reading card D6.1 → T6.11): review items carry it. */
  ku: z.string().regex(/^(T6|T9|N7|N8|TH)\.[0-9]{1,2}$/),
  title: z.string().min(3).max(100),
  variants: z.tuple([CardVariant, CardVariant]),
  review: z.array(ReviewQuestion).min(1).max(3),
}).strict();
export type Card = z.infer<typeof Card>;
export type ReviewQuestion = z.infer<typeof ReviewQuestion>;

export const CardBundle = z.object({ version: z.string(), cards: z.array(Card) }).strict();
export type CardBundle = z.infer<typeof CardBundle>;

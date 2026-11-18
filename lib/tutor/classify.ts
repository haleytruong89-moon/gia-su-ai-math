// lib/tutor/classify.ts — first turn of a problem: which SGK lesson (KU), which item of the grade 10 entrance
// exam (D27) and whether it is a geometry proof (§4.14 Opus signal). Haiku; never throws (G5).
import { z } from "zod";
import { costUsd } from "@/lib/anthropic";
import { kuIndex } from "@/lib/knowledge/card";
import { codeFitsGrade } from "@/lib/knowledge/load";
import { imageBlocks, type ImageData } from "@/lib/tutor/assemble";
import type { ModelClient } from "@/lib/tutor/turn";

export interface Classification { ku_code: string | null; exam_slot: string | null; geometry_proof: boolean }
export interface ClassifyCall { model: string; raw: string; costUsd: number; tokens: { in: number; cached: number; out: number } }
export const EMPTY: Classification = { ku_code: null, exam_slot: null, geometry_proof: false };
export const EXAM_SLOT = /^HN10-[1-5][a-c]?(-y[12])?$/;

const answer = z.object({ ku_code: z.string().nullable(), exam_slot: z.string().nullable(), geometry_proof: z.boolean() });
const schema = {
  type: "object",
  properties: { ku_code: { type: ["string", "null"] }, exam_slot: { type: ["string", "null"] }, geometry_proof: { type: "boolean" } },
  required: ["ku_code", "exam_slot", "geometry_proof"],
  additionalProperties: false,
};

export async function classifyProblem(client: ModelClient, d: { model: string; prompt: string },
  input: { grade: 6 | 9; statement: string | null; image?: ImageData }): Promise<{ output: Classification; call: ClassifyCall | null }> {
  const text = `Lớp: ${input.grade}\nĐề (học sinh gõ hoặc trong ảnh):\n${input.statement ?? "(xem ảnh)"}`;
  try {
    const res = await client.create({
      model: d.model, max_tokens: 2000, thinking: { type: "disabled" },
      system: [
        { type: "text", text: d.prompt },
        { type: "text", text: `DANH MỤC bài SGK lớp ${input.grade}:\n${kuIndex(input.grade)}`, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: input.image ? [...imageBlocks([input.image]), { type: "text", text }] : text }],
      output_config: { effort: "low", format: { type: "json_schema", schema } },
    });
    const raw = res.content.filter((p) => p.type === "text").map((p) => p.text ?? "").join("");
    const cached = res.usage.cache_read_input_tokens ?? 0;
    const call: ClassifyCall = { model: d.model, raw, costUsd: costUsd(d.model, res.usage),
      tokens: { in: res.usage.input_tokens + cached + (res.usage.cache_creation_input_tokens ?? 0), cached, out: res.usage.output_tokens } };
    let a: z.infer<typeof answer>;
    try {
      a = answer.parse(JSON.parse(raw));
    } catch {
      return { output: EMPTY, call };
    }
    const nine = input.grade === 9;
    return {
      output: {
        ku_code: a.ku_code && codeFitsGrade(a.ku_code, input.grade) ? a.ku_code : null,
        exam_slot: nine && a.exam_slot && EXAM_SLOT.test(a.exam_slot) ? a.exam_slot : null,
        geometry_proof: nine && a.geometry_proof,
      },
      call,
    };
  } catch (e) {
    console.error("classify call failed", e instanceof Error ? e.message : "unknown");
    return { output: EMPTY, call: null };
  }
}

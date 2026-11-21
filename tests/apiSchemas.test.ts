import { describe, expect, it } from "vitest";
import { siblingJsonSchema } from "@/lib/tools/makeSibling";
import { ruleDraftJsonSchema } from "@/lib/tutor/ruleDraft";
import { referenceJsonSchema } from "@/lib/tutor/reference";
import { classifyJsonSchema } from "@/lib/tutor/classify";
import { guardJsonSchema } from "@/lib/tutor/guard";
import { tutorOutputJsonSchema } from "@/lib/tutor/schema";

// Structured outputs refuse some JSON Schema features with HTTP 400 (G0 run 1, 15/11; run 5, 18/11).
// Fake clients in unit tests never see that, so every schema sent as output_config.format is checked here.
const REFUSED = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength", "maxItems", "pattern"];
function problems(node: unknown, path = "$"): string[] {
  if (Array.isArray(node)) return node.flatMap((n, i) => problems(n, `${path}[${i}]`));
  if (!node || typeof node !== "object") return [];
  const o = node as Record<string, unknown>;
  const out: string[] = [];
  for (const k of REFUSED) if (k in o) out.push(`${path}.${k}`);
  if (o.type === "object" || (Array.isArray(o.type) && o.type.includes("object"))) {
    if (o.additionalProperties !== false) out.push(`${path}.additionalProperties must be false`);
  }
  for (const [k, v] of Object.entries(o)) if (k !== "enum" && k !== "const") out.push(...problems(v, `${path}.${k}`));
  return out;
}

describe("schemas sent as structured output", () => {
  it.each([
    ["tutor", tutorOutputJsonSchema], ["classify", classifyJsonSchema], ["guard", guardJsonSchema], ["sibling", siblingJsonSchema], ["rule_draft", ruleDraftJsonSchema], ["reference", referenceJsonSchema],
  ])("%s schema uses only what the API accepts", (_name, schema) => {
    expect(problems(schema)).toEqual([]);
  });
  it("the checker catches the 18/11 bug", () => {
    expect(problems({ type: "object", properties: { v: { type: "object", additionalProperties: { type: "string" } } }, additionalProperties: false }))
      .toEqual(["$.properties.v.additionalProperties must be false"]);
  });
});

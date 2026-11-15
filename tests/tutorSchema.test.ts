// tests/tutorSchema.test.ts
import { describe, expect, it } from "vitest";
import fewshot from "./fixtures/fewshot.json";
import { parseTutorOutput, tutorOutputJsonSchema } from "@/lib/tutor/schema";

describe("TutorOutput", () => {
  it.each(fewshot as object[])("few-shot example %# parses", (ex) => {
    expect(parseTutorOutput(JSON.stringify(ex)).ok).toBe(true);
  });
  it("never returns more than 4 buttons (extra ones are dropped, the reply is kept)", () => {
    const many = { ...(fewshot as Record<string, unknown>[])[0], buttons: ["a", "b", "c", "d", "e"] };
    const r = parseTutorOutput(JSON.stringify(many));
    expect(r.ok && r.value.buttons).toEqual(["a", "b", "c", "d"]);
  });
  it("rejects text outside JSON", () => {
    expect(parseTutorOutput("Cô nghĩ là {\"message\":\"x\"}").ok).toBe(false);
  });
  it("JSON schema forbids extra keys", () => {
    expect(tutorOutputJsonSchema.additionalProperties).toBe(false);
  });
});

import { apiSafeSchema } from "@/lib/tutor/schema";

const sample = (fewshot as Record<string, unknown>[])[0];

describe("apiSafeSchema (structured outputs reject size/range constraints — 400 seen in G0 run 1)", () => {
  const UNSUPPORTED = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength", "maxItems", "pattern", "$schema"];
  const keysDeep = (v: unknown, acc: string[] = []): string[] => {
    if (Array.isArray(v)) v.forEach((x) => keysDeep(x, acc));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { acc.push(k); keysDeep(x, acc); }
    return acc;
  };
  it("removes every unsupported keyword, deep", () => {
    const keys = keysDeep(tutorOutputJsonSchema);
    for (const k of UNSUPPORTED) expect(keys, k).not.toContain(k);
  });
  it("keeps the shape: same required fields, enums, no extra properties", () => {
    const s = tutorOutputJsonSchema as { required: string[]; additionalProperties: boolean; properties: Record<string, { enum?: string[] }> };
    expect(s.required).toHaveLength(13);
    expect(s.additionalProperties).toBe(false);
    expect(s.properties.danh_gia_luot_em?.enum).toContain("xin_dap_an");
  });
  it("moves the limit into the description so the model still sees it", () => {
    const b = (apiSafeSchema({ type: "array", maxItems: 4, items: { type: "string", maxLength: 40 } }) as { description: string; items: { description: string } });
    expect(b.description).toBe("{maxItems: 4}");
    expect(b.items.description).toBe("{maxLength: 40}");
  });
  it("keeps minItems 0 or 1, drops larger", () => {
    expect(apiSafeSchema({ type: "array", minItems: 1 })).toEqual({ type: "array", minItems: 1 });
    expect(apiSafeSchema({ type: "array", minItems: 2 })).toEqual({ type: "array", description: "{minItems: 2}" });
  });
});

describe("parseTutorOutput is lenient on button count/length (now only checked here, not by the API)", () => {
  it("keeps the first 4 buttons and trims long ones instead of dropping the whole reply", () => {
    const o = { ...JSON.parse(JSON.stringify(sample)), buttons: ["a", "b", "c", "d", "e", "x".repeat(60)] };
    const r = parseTutorOutput(JSON.stringify(o));
    expect(r.ok && r.value.buttons).toEqual(["a", "b", "c", "d"]);
  });

  it("a malformed knowledge code becomes null instead of losing the reply", () => {
    const r = parseTutorOutput(JSON.stringify({ ...sample, ku_code_de_xuat: "T9.3a", prereq_gap: "N8-02", checklist_da_hoi: [2, 11] }));
    expect(r.ok && [r.value.ku_code_de_xuat, r.value.prereq_gap, r.value.checklist_da_hoi]).toEqual([null, null, [2]]);
  });
});

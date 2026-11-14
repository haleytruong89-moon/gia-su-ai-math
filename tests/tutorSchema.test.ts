// tests/tutorSchema.test.ts
import { describe, expect, it } from "vitest";
import fewshot from "./fixtures/fewshot.json";
import { parseTutorOutput, tutorOutputJsonSchema } from "@/lib/tutor/schema";

describe("TutorOutput", () => {
  it.each(fewshot as object[])("few-shot example %# parses", (ex) => {
    expect(parseTutorOutput(JSON.stringify(ex)).ok).toBe(true);
  });
  it("rejects more than 4 buttons", () => {
    const bad = { ...(fewshot as Record<string, unknown>[])[0], buttons: ["a", "b", "c", "d", "e"] };
    expect(parseTutorOutput(JSON.stringify(bad)).ok).toBe(false);
  });
  it("rejects text outside JSON", () => {
    expect(parseTutorOutput("Cô nghĩ là {\"message\":\"x\"}").ok).toBe(false);
  });
  it("JSON schema forbids extra keys", () => {
    expect(tutorOutputJsonSchema.additionalProperties).toBe(false);
  });
});

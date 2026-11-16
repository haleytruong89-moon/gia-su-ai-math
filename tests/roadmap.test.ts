import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";

// docs/ROADMAP.json is the single source for the progress map page. Every PR updates it.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sliceStatus = z.enum(["done", "in_progress", "next", "planned", "later"]);
const featureStatus = z.enum(["done", "review", "doing", "todo"]);

const Roadmap = z.object({
  schema: z.literal(1),
  project: z.string(),
  updated: isoDate,
  updatedNote: z.string().min(1),
  vision: z.object({
    oneLiner: z.string(),
    problem: z.string(),
    users: z.array(z.object({ who: z.string(), when: z.string(), devices: z.string(), focus: z.string() })),
    flows: z.array(z.object({ id: z.string(), name: z.string(), status: z.enum(["building", "planned", "later", "done"]), text: z.string() })),
    principles: z.array(z.string()),
    pilot: z.object({ length: z.string(), goNoGo: z.array(z.string()) }),
  }),
  architecture: z.object({
    summary: z.string(),
    layers: z.array(z.object({ name: z.string(), items: z.array(z.string()) })),
    turn: z.array(z.string()),
  }),
  slices: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: sliceStatus,
      done: isoDate.optional(),
      goal: z.string(),
      features: z.array(z.object({ name: z.string(), status: featureStatus })).min(1),
      acceptance: z.array(z.string()),
      prs: z.array(z.object({ repo: z.enum(["gia-su", "launcher"]), number: z.number().int().positive(), status: z.enum(["open", "merged", "closed"]) })).optional(),
      sql: z.array(z.string()).optional(),
      depends: z.array(z.string()).optional(),
      notes: z.string().optional(),
    }),
  ),
  decisions: z.array(z.object({ id: z.string(), text: z.string(), status: z.enum(["confirmed", "proposed", "dropped"]), date: isoDate })),
  parentTodo: z.array(z.object({ text: z.string(), slice: z.string(), status: z.enum(["open", "done"]) })),
  risks: z.array(z.object({ text: z.string(), mitigation: z.string(), status: z.enum(["open", "closed"]) })),
  metrics: z.record(z.string(), z.union([z.string(), z.number()])),
  log: z.array(z.object({ date: isoDate, text: z.string() })).min(1),
});

const raw = JSON.parse(readFileSync("docs/ROADMAP.json", "utf8"));

describe("docs/ROADMAP.json", () => {
  const r = Roadmap.parse(raw);

  it("slice ids are unique and dependencies exist", () => {
    const ids = r.slices.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of r.slices) for (const d of s.depends ?? []) expect(ids, `${s.id} depends on ${d}`).toContain(d);
    for (const t of r.parentTodo) expect(ids, `todo slice ${t.slice}`).toContain(t.slice);
  });

  it("a done slice has a date and only done features; an open PR means the slice is not done", () => {
    for (const s of r.slices) {
      if (s.status === "done") {
        expect(s.done, s.id).toBeDefined();
        const open = s.features.filter((f) => f.status !== "done" && !/chạy lại/i.test(f.name));
        expect(open.map((f) => f.name), s.id).toEqual([]);
        expect((s.prs ?? []).filter((p) => p.status === "open"), s.id).toEqual([]);
      }
    }
  });

  it("the log is in date order and 'updated' is its last date", () => {
    const dates = r.log.map((l) => l.date);
    expect([...dates].sort()).toEqual(dates);
    expect(r.updated).toBe(dates.at(-1));
  });

  it("public repo: no real names, emails or keys", () => {
    const text = JSON.stringify(raw);
    expect(text).not.toMatch(/@[a-z0-9-]+\.(com|vn)/i);
    expect(text).not.toMatch(/sk-ant-|eyJhbGci/);
  });
});

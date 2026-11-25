import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ATTENTION_SOURCE, writeAttention } from "@/lib/report/attentionSync";
import type { Flag } from "@/lib/report/flags";

/** A tiny stand-in for the Supabase client: records upserts and deletes on public.learning_attention. */
function fakeDb() {
  const log: { op: string; table: string; rows?: unknown; filters: [string, string, unknown][] }[] = [];
  const db = {
    from(table: string) {
      return {
        async upsert(rows: unknown) { log.push({ op: "upsert", table, rows, filters: [] }); return { error: null }; },
        delete() {
          const entry = { op: "delete", table, filters: [] as [string, string, unknown][] };
          log.push(entry);
          const chain = {
            eq(c: string, v: unknown) { entry.filters.push(["eq", c, v]); return chain; },
            gt(c: string, v: unknown) { entry.filters.push(["gt", c, v]); return Promise.resolve({ error: null }); },
          };
          return chain;
        },
      };
    },
  };
  return { db: db as unknown as SupabaseClient, log };
}
const flag = (kind: Flag["kind"], text: string): Flag => ({ kind, text, problemIds: [] });
const at = { familyId: "f1", childId: "c1", date: "2026-11-25", now: new Date("2026-11-25T15:30:00Z") };

describe("writeAttention (G8-fix4: the report's own flags go to the Launcher)", () => {
  it("writes the first two flags as slots 1–2 and removes slots above", async () => {
    const { db, log } = fakeDb();
    await writeAttention(db, at, [flag("cas_loi", "A"), flag("cau_soan_san", "B"), flag("bai_hinh", "C")]);
    expect(log[0]).toMatchObject({ op: "upsert", table: "learning_attention", rows: [
      { family_id: "f1", child_id: "c1", local_date: "2026-11-25", source: ATTENTION_SOURCE, slot: 1, body: "A" },
      { family_id: "f1", child_id: "c1", local_date: "2026-11-25", source: ATTENTION_SOURCE, slot: 2, body: "B" },
    ] });
    expect(log[1]?.filters).toContainEqual(["gt", "slot", 2]);
  });
  it("no flags → nothing written, old lines of the day removed", async () => {
    const { db, log } = fakeDb();
    await writeAttention(db, at, []);
    expect(log.map((x) => x.op)).toEqual(["delete"]);
    expect(log[0]?.filters).toEqual([["eq", "family_id", "f1"], ["eq", "child_id", "c1"], ["eq", "local_date", "2026-11-25"],
      ["eq", "source", ATTENTION_SOURCE], ["gt", "slot", 0]]);
  });
});

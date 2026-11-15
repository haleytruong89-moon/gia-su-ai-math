import { describe, expect, it } from "vitest";
import { withRetry } from "@/lib/anthropic";

const ok = { content: [{ type: "text", text: "{}" }], usage: { input_tokens: 1, output_tokens: 1 } };
const err = (status: number) => Object.assign(new Error("x"), { status });

describe("withRetry (DOMAIN §5: one retry on overload / server error)", () => {
  it("retries once on 529 overloaded", async () => {
    let n = 0;
    const c = withRetry({ create: async () => { n++; if (n === 1) throw err(529); return ok; } }, 0);
    expect(await c.create({})).toBe(ok);
    expect(n).toBe(2);
  });
  it("does not retry a 400", async () => {
    let n = 0;
    const c = withRetry({ create: async () => { n++; throw err(400); } }, 0);
    await expect(c.create({})).rejects.toThrow();
    expect(n).toBe(1);
  });
  it("gives up after the second failure", async () => {
    let n = 0;
    const c = withRetry({ create: async () => { n++; throw err(500); } }, 0);
    await expect(c.create({})).rejects.toThrow();
    expect(n).toBe(2);
  });
  it("retries a network error (no status)", async () => {
    let n = 0;
    const c = withRetry({ create: async () => { n++; if (n === 1) throw new Error("ECONNRESET"); return ok; } }, 0);
    expect(await c.create({})).toBe(ok);
  });
});
